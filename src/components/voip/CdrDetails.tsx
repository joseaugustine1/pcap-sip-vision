import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Phone, User, Clock, Radio, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface CdrDetailsProps {
  sessionId: string;
}

interface CdrInfo {
  callId: string;
  fromUser: string;
  fromUri: string;
  toUser: string;
  toUri: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
}

export const CdrDetails = ({ sessionId }: CdrDetailsProps) => {
  const [cdrData, setCdrData] = useState<CdrInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadCdrData();
  }, [sessionId]);

  const loadCdrData = async () => {
    try {
      setLoading(true);

      // Get all SIP messages for this session
      const { data: messages, error } = await supabase
        .from("sip_messages")
        .select("*")
        .eq("session_id", sessionId)
        .eq("method", "INVITE")
        .order("timestamp", { ascending: true });

      if (error) throw error;

      // Parse CDR info from INVITE messages, deduplicate by Call-ID
      const cdrMap = new Map<string, CdrInfo>();
      
      for (const msg of messages || []) {
        if (!msg.content) continue;

        const fromMatch = msg.content.match(/From:\s*(?:"([^"]*)")?\s*<sip:([^@>]+)@?([^>]*)>/i);
        const toMatch = msg.content.match(/To:\s*(?:"([^"]*)")?\s*<sip:([^@>]+)@?([^>]*)>/i);
        const callIdMatch = msg.content.match(/Call-ID:\s*([^\r\n]+)/i);

        if (callIdMatch) {
          const callId = callIdMatch[1].trim();
          
          // Skip if we already have this Call-ID
          if (cdrMap.has(callId)) continue;
          
          // Get call metrics for duration
          const { data: callMetrics } = await supabase
            .from("call_metrics")
            .select("start_time, end_time, duration")
            .eq("call_id", callId)
            .single();

          cdrMap.set(callId, {
            callId,
            fromUser: fromMatch ? (fromMatch[1] || fromMatch[2]) : "Unknown",
            fromUri: fromMatch ? `${fromMatch[2]}@${fromMatch[3]}` : "Unknown",
            toUser: toMatch ? (toMatch[1] || toMatch[2]) : "Unknown",
            toUri: toMatch ? `${toMatch[2]}@${toMatch[3]}` : "Unknown",
            startTime: msg.timestamp,
            endTime: callMetrics?.end_time || null,
            duration: callMetrics?.duration || null,
          });
        }
      }

      setCdrData(Array.from(cdrMap.values()));
    } catch (error) {
      console.error("Error loading CDR data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 glass-card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (cdrData.length === 0) {
    return (
      <Card className="p-6 glass-card">
        <p className="text-sm text-muted-foreground">No call detail records available yet</p>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-6 glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Call Detail Records</h3>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="space-y-4">
            {cdrData.map((cdr, index) => (
              <div key={index} className="border border-border rounded-lg p-4 bg-background/30">
                <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
                  <Phone className="w-4 h-4 text-primary" />
                  <h4 className="font-medium text-sm text-foreground">Call #{index + 1}</h4>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Caller Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Caller (From)</span>
                </div>
                <div className="pl-6 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-mono text-foreground">{cdr.fromUser}</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{cdr.fromUri}</p>
                </div>
              </div>

              {/* Called Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Called (To)</span>
                </div>
                <div className="pl-6 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-mono text-foreground">{cdr.toUser}</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{cdr.toUri}</p>
                </div>
              </div>

              {/* Call ID */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Call ID</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground pl-6">{cdr.callId}</p>
              </div>

              {/* Time Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Call Time</span>
                </div>
                <div className="pl-6 space-y-1">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Start: </span>
                    <span className="font-mono text-foreground">
                      {format(new Date(cdr.startTime), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </p>
                  {cdr.endTime && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-mono text-foreground">
                        {format(new Date(cdr.endTime), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                    </p>
                  )}
                  {cdr.duration && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Duration: </span>
                      <span className="font-mono text-foreground">{cdr.duration.toFixed(1)}s</span>
                    </p>
                  )}
                </div>
              </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
