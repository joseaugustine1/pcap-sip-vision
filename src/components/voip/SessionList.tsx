import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Activity, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  name: string;
  created_at: string;
  status: string;
  total_calls: number;
  avg_mos: number | null;
  avg_jitter: number | null;
  avg_latency: number | null;
}

interface SessionListProps {
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
}

export const SessionList = ({ selectedSessionId, onSelectSession }: SessionListProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();

    // Subscribe to changes
    const channel = supabase
      .channel("sessions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analysis_sessions" },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("analysis_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "processing":
        return "bg-primary/10 text-primary border-primary/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getMosColor = (mos: number | null) => {
    if (!mos) return "text-muted-foreground";
    if (mos >= 4.0) return "text-success";
    if (mos >= 3.5) return "text-warning";
    return "text-destructive";
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Analysis Sessions</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{sessions.length} total sessions</p>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="p-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs mt-1">Upload PCAP files to get started</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedSessionId === session.id
                    ? "bg-primary/5 border-primary shadow-md"
                    : "bg-card/50 border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-sm text-foreground line-clamp-2">{session.name}</h4>
                  {getStatusIcon(session.status)}
                </div>

                <div className="space-y-2">
                  <Badge variant="outline" className={`text-xs ${getStatusColor(session.status)}`}>
                    {session.status}
                  </Badge>

                  {session.avg_mos !== null && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">MOS:</span>
                      <span className={`font-semibold ${getMosColor(session.avg_mos)}`}>
                        {session.avg_mos.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
