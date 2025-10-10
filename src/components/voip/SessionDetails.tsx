import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { MetricsOverview } from "./MetricsOverview";
import { CallMetricsTable } from "./CallMetricsTable";
import { SipLadder } from "./SipLadder";
import { IntervalChart } from "./IntervalChart";
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

    // Subscribe to changes
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analysis_sessions", filter: `id=eq.${sessionId}` },
        () => loadSessionData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_metrics", filter: `session_id=eq.${sessionId}` },
        () => loadSessionData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } = await supabase
        .from("analysis_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      const { data: callsData, error: callsError } = await supabase
        .from("call_metrics")
        .select("*")
        .eq("session_id", sessionId)
        .order("start_time", { ascending: false });

      if (callsError) throw callsError;
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
      
      <MetricsOverview session={session} calls={calls} />

      <Card className="glass-card">
        <Tabs defaultValue="calls" className="w-full">
          <div className="border-b border-border px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="calls">Call Metrics</TabsTrigger>
              <TabsTrigger value="intervals">Time Series</TabsTrigger>
              <TabsTrigger value="sip">SIP Ladder</TabsTrigger>
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
        </Tabs>
      </Card>
    </div>
  );
};
