import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api";
import { MetricsOverview } from "./MetricsOverview";
import { CallMetricsTable } from "./CallMetricsTable";
import { SipLadder } from "./SipLadder";
import { IntervalChart } from "./IntervalChart";
import { CdrDetails } from "./CdrDetails";
import { AudioPlayback } from "./AudioPlayback";
import { DiagnosticsTab } from "./DiagnosticsTab";
import { Loader2 } from "lucide-react";

interface SessionDetailsProps {
  sessionId: string;
}

export const SessionDetails = ({ sessionId }: SessionDetailsProps) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    loadSessionData();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(loadSessionData, 3000);
    
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      const sessionData = await apiClient.getSession(sessionId);
      setSession(sessionData);

      const callsData = await apiClient.getCallMetrics(sessionId);
      setCalls(callsData || []);
    } catch (error) {
      console.error("Error loading session data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-12 flex items-center justify-center glass-card">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Card>
    );
  }

  const isProcessing = session?.status === 'processing' || session?.status === 'pending';
  const progress = session?.status === 'completed' ? 100 : 
                   session?.status === 'processing' ? 50 : 0;

  return (
    <div className="space-y-6">
      {isProcessing && (
        <Card className="p-6 glass-card">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {session?.status === 'pending' ? 'Starting analysis...' : 'Analyzing PCAP files...'}
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
