import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface SipLadderProps {
  sessionId: string;
}

interface SipMessage {
  id: string;
  timestamp: string;
  source_ip: string;
  source_port: number;
  dest_ip: string;
  dest_port: number;
  method: string | null;
  status_code: number | null;
  message_type: string;
  content: string | null;
}

export const SipLadder = ({ sessionId }: SipLadderProps) => {
  const [messages, setMessages] = useState<SipMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uniqueIps, setUniqueIps] = useState<string[]>([]);

  useEffect(() => {
    loadSipMessages();
  }, [sessionId]);

  const loadSipMessages = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("sip_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("timestamp", { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Extract unique IPs
      const ips = new Set<string>();
      data?.forEach((msg) => {
        ips.add(msg.source_ip);
        ips.add(msg.dest_ip);
      });
      setUniqueIps(Array.from(ips));
    } catch (error) {
      console.error("Error loading SIP messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMessageColor = (msg: SipMessage) => {
    if (msg.method === "INVITE") return "text-primary";
    if (msg.method === "ACK") return "text-success";
    if (msg.method === "BYE") return "text-destructive";
    if (msg.status_code) {
      if (msg.status_code >= 200 && msg.status_code < 300) return "text-success";
      if (msg.status_code >= 400) return "text-destructive";
      return "text-warning";
    }
    return "text-muted-foreground";
  };

  const getMessageLabel = (msg: SipMessage) => {
    if (msg.method) return msg.method;
    if (msg.status_code) return `${msg.status_code}`;
    return msg.message_type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No SIP messages available yet</p>
        <p className="text-sm text-muted-foreground mt-1">Analysis in progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* IP Address Legend */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
        {uniqueIps.map((ip, index) => (
          <div key={ip} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-chart-${(index % 5) + 1}`} />
            <code className="text-sm font-mono">{ip}</code>
          </div>
        ))}
      </div>

      {/* SIP Ladder */}
      <ScrollArea className="h-[600px] border border-border rounded-lg bg-card/50">
        <div className="p-6 space-y-4">
          {messages.map((msg, index) => {
            const sourceIndex = uniqueIps.indexOf(msg.source_ip);
            const destIndex = uniqueIps.indexOf(msg.dest_ip);
            const direction = sourceIndex < destIndex ? "right" : "left";

            return (
              <div key={msg.id} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(msg.timestamp), "HH:mm:ss.SSS")}</span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Source IP */}
                  <div className="w-32 text-right">
                    <code className="text-xs font-mono">{msg.source_ip}</code>
                    <div className="text-xs text-muted-foreground">:{msg.source_port}</div>
                  </div>

                  {/* Arrow and Message */}
                  <div className="flex-1 flex items-center gap-2">
                    {direction === "right" ? (
                      <>
                        <div className="flex-1 h-px bg-border" />
                        <Badge className={getMessageColor(msg)}>{getMessageLabel(msg)}</Badge>
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4 text-primary rotate-180" />
                        <Badge className={getMessageColor(msg)}>{getMessageLabel(msg)}</Badge>
                        <div className="flex-1 h-px bg-border" />
                      </>
                    )}
                  </div>

                  {/* Destination IP */}
                  <div className="w-32 text-left">
                    <code className="text-xs font-mono">{msg.dest_ip}</code>
                    <div className="text-xs text-muted-foreground">:{msg.dest_port}</div>
                  </div>
                </div>

                {msg.content && (
                  <details className="ml-36 mr-36">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      View message content
                    </summary>
                    <pre className="mt-2 p-3 bg-muted/50 rounded text-xs overflow-auto">
                      {msg.content}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
