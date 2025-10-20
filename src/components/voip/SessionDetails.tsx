import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { MetricsOverview } from "./MetricsOverview";
import { CallMetricsTable } from "./CallMetricsTable";
import { SipLadder } from "./SipLadder";
import { IntervalChart } from "./IntervalChart";
import { CdrDetails } from "./CdrDetails";
import { AudioPlayback } from "./AudioPlayback";
import { DiagnosticsTab } from "./DiagnosticsTab";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

// --------- Types ----------
type SessionStatus = "pending" | "processing" | "completed" | "failed";

interface Session {
  id: string;
  status: SessionStatus;
  progress?: number; // 0..100 (optional from server)
  created_at?: string;
  updated_at?: string;
  // add any other fields your UI needs...
}

interface CallMetric {
  call_id: string;
  mos_avg?: number;
  jitter_avg_ms?: number;
  rtt_avg_ms?: number;
  packet_loss_pct?: number;
  // add the rest of your call metrics
}

interface SessionDetailsProps {
  sessionId: string;
}

export const SessionDetails = ({ sessionId }: SessionDetailsProps) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<CallMetric[]>([]);
  const mountedRef = useRef(true);

  // Reset when sessionId changes
  useEffect(() => {
    setSession(null);
    setCalls([]);
    setLoading(true);
  }, [sessionId]);

  // Keep an isMounted flag to avoid setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ Use the dedicated apiClient methods
  const fetchSession = useCallback(async (id: string): Promise<Session> => {
    return await apiClient.getSession(id);
  }, []);

  const fetchCallMetrics = useCallback(async (id: string): Promise<CallMetric[]> => {
    return await apiClient.getCallMetrics(id);
  }, []);

  const loadSessionData = useCallback(async () => {
    try {
      // Don’t force loading=true on every poll (prevents flicker)
      const [sessionData, callsData] = await Promise.all([
        fetchSession(sessionId),
        fetchCallMetrics(sessionId),
      ]);

      if (!mountedRef.current) return;
      setSession(sessionData);
      setCalls(callsData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading session data:", error);
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [fetchSession, fetchCallMetrics, sessionId]);

  // Initial fetch + smart polling
  useEffect(() => {
    let interval: number | undefined;

    const start = async () => {
      await loadSessionData();

      // Poll only if still processing
      const shouldPoll =
        session?.status === "pending" ||
        session?.status === "processing" ||
        !session; // if first fetch hasn’t filled yet

      if (shouldPoll) {
        interval = window.setInterval(loadSessionData, 3000);
      }
    };

    start();

    return () => {
      if (interval) window.clearInterval(interval);
    };
    // Intentionally exclude `session` here to avoid resetting interval on every state change.
    // We stop polling by clearing in the next effect once status becomes terminal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSessionData]);

  // Stop polling once we reach a terminal state
  useEffect(() => {
    if (!session) return;
    if (session.status === "completed" || session.status === "failed") {
      // Cleanup handled by the effect above; no-op here.
    }
  }, [session]);

  if (loading) {
    return (
      <Card className="p-12 flex items-center justify-center glass-card">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Card>
    );
  }

  // Prefer server-sent progress; else fallback mapping.
  const status = session?.status;
  const progress =
    session?.progress ?? (status === "completed" ? 100 : status === "processing" ? 50 : 0);

  const isProcessing = status === "processing" || status === "pending";

  return (
    <div className="space-y-6">
      {isProcessing && (
        <Card className="p-6 glass-card">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {status === "pending" ? "Starting analysis..." : "Analyzing PCAP files..."}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      )}

      <CdrDetails sessionId={sessionId} />

      <MetricsOverview session={session} calls={calls} />

      <Card className="glass-card">
        <Tabs defaultValue="calls" className="w-full">
          <div className="border-b border-border px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="calls">Call Metrics</TabsTrigger>
              <TabsTrigger value="intervals">Time Series</TabsTrigger>
              <TabsTrigger value="sip">SIP Ladder</TabsTrigger>
              <TabsTrigger value="audio">Audio Playback</TabsTrigger>
              <TabsTrigger value="diagnostics">Advanced Diagnostics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="calls" className="p-6">
            <CallMetricsTable calls={calls} />
          </TabsContent>

          <TabsContent value="intervals" className="p-6">
            <IntervalChart sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="sip" className="p-6">
            <SipLadder sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="audio" className="p-6">
            <AudioPlayback sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="diagnostics" className="p-6">
            <DiagnosticsTab sessionId={sessionId} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
