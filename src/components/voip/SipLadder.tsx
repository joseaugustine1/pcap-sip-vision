import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { IpLookupBadge } from "./IpLookupBadge";

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
      {/* IP Address Legend - Wireshark Style */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-background/50 border border-primary/30 rounded font-mono text-xs">
        <div className="font-bold text-primary">{'>'} ENDPOINT_A</div>
        <div className="font-bold text-primary">{'>'} ENDPOINT_B</div>
        {uniqueIps.slice(0, 2).map((ip, index) => (
          <div key={ip} className="flex items-center gap-2 text-foreground">
            <div className={`w-2 h-2 rounded-full bg-chart-${index + 1} shadow-[0_0_8px_currentColor]`} style={{color: `hsl(var(--chart-${index + 1}))`}} />
            <code className="text-xs">{ip}</code>
          </div>
        ))}
      </div>

      {/* SIP Ladder - Wireshark Flow Style */}
      <ScrollArea className="h-[600px] border border-primary/30 rounded bg-background/30">
        <div className="p-6">
          {/* Timeline Header */}
          <div className="flex items-center gap-4 mb-6 pb-3 border-b border-primary/30">
            <div className="w-24 text-xs font-mono text-primary">TIME</div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="text-xs font-mono text-center text-primary">SOURCE</div>
              <div className="text-xs font-mono text-center text-primary">METHOD/STATUS</div>
              <div className="text-xs font-mono text-center text-primary">DESTINATION</div>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {messages.map((msg, index) => {
              const sourceIndex = uniqueIps.indexOf(msg.source_ip);
              const destIndex = uniqueIps.indexOf(msg.dest_ip);
              const direction = sourceIndex < destIndex ? "right" : "left";

              return (
                <div key={msg.id} className="group relative">
                  <div className="flex items-center gap-4 hover:bg-primary/5 p-2 rounded transition-colors">
                    {/* Timestamp */}
                    <div className="w-24 text-xs font-mono text-muted-foreground">
                      {format(new Date(msg.timestamp), "HH:mm:ss.SSS")}
                    </div>

                    {/* Flow Diagram */}
                    <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                      {/* Source */}
                      <div className={`text-xs font-mono ${direction === "right" ? "text-right pr-2" : "text-left pl-2"} space-y-1`}>
                        <div className="flex items-center gap-1 justify-end">
                          <div className="text-foreground">{msg.source_ip}</div>
                        </div>
                        <div className="text-muted-foreground">:{msg.source_port}</div>
                        <IpLookupBadge ip={msg.source_ip} />
                      </div>

                      {/* Arrow and Message */}
                      <div className="flex items-center justify-center gap-2 relative">
                        {direction === "right" ? (
                          <>
                            <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-primary" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Badge 
                                className={`${getMessageColor(msg)} text-[10px] px-2 py-0.5 font-mono shadow-lg`}
                              >
                                {getMessageLabel(msg)}
                              </Badge>
                            </div>
                            <ArrowRight className="w-4 h-4 text-primary drop-shadow-[0_0_6px_currentColor]" />
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4 text-primary rotate-180 drop-shadow-[0_0_6px_currentColor]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Badge 
                                className={`${getMessageColor(msg)} text-[10px] px-2 py-0.5 font-mono shadow-lg`}
                              >
                                {getMessageLabel(msg)}
                              </Badge>
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-l from-primary/50 to-primary" />
                          </>
                        )}
                      </div>

                      {/* Destination */}
                      <div className={`text-xs font-mono ${direction === "left" ? "text-right pr-2" : "text-left pl-2"} space-y-1`}>
                        <div className="flex items-center gap-1">
                          <div className="text-foreground">{msg.dest_ip}</div>
                        </div>
                        <div className="text-muted-foreground">:{msg.dest_port}</div>
                        <IpLookupBadge ip={msg.dest_ip} />
                      </div>
                    </div>
                  </div>

                  {/* Message Content Expandable */}
                  {msg.content && (
                    <details className="ml-28 mt-2">
                      <summary className="text-xs text-primary cursor-pointer hover:text-primary-glow font-mono">
                        {'>'} VIEW_RAW_MESSAGE
                      </summary>
                      <pre className="mt-2 p-3 bg-background/80 border border-primary/20 rounded text-[10px] overflow-auto font-mono text-muted-foreground">
                        {msg.content}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
