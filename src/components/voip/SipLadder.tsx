import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
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
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

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

  const extractComment = (msg: SipMessage) => {
    if (!msg.content) return "";
    
    // Extract From header for comment
    const fromMatch = msg.content.match(/From:\s*(.+)/i);
    const toMatch = msg.content.match(/To:\s*(.+)/i);
    
    let comment = "";
    if (msg.method) {
      comment = `SIP ${msg.method}`;
      if (fromMatch) comment += ` From: ${fromMatch[1].split('\n')[0].trim()}`;
    } else if (msg.status_code) {
      comment = `SIP Status ${msg.status_code}`;
    }
    
    return comment;
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
    <div className="space-y-4">
      {/* SIP Ladder - Compact Wireshark Style */}
      <div className="border border-border rounded-lg bg-background/50 overflow-hidden">
        {/* Header with IP addresses */}
        <div className="grid grid-cols-[140px_1fr_1fr_200px] gap-2 p-3 bg-muted/30 border-b border-border text-xs font-mono">
          <div className="font-semibold">Time</div>
          <div className="font-semibold text-center">{uniqueIps[0] || "Source"}</div>
          <div className="font-semibold text-center">{uniqueIps[1] || "Destination"}</div>
          <div className="font-semibold">Comment</div>
        </div>

        {/* Message rows */}
        <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
          <div className="divide-y divide-border/50">
            {messages.map((msg) => {
              const sourceIndex = uniqueIps.indexOf(msg.source_ip);
              const destIndex = uniqueIps.indexOf(msg.dest_ip);
              const isLeftToRight = sourceIndex < destIndex;
              const isSelected = selectedMessage === msg.id;

              return (
                <div key={msg.id} className="hover:bg-muted/20 transition-colors">
                  <div
                    className="grid grid-cols-[140px_1fr_1fr_200px] gap-2 p-2 cursor-pointer"
                    onClick={() => setSelectedMessage(isSelected ? null : msg.id)}
                  >
                    {/* Timestamp */}
                    <div className="text-xs font-mono text-muted-foreground">
                      {format(new Date(msg.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}
                    </div>

                    {/* Source Column */}
                    <div className="flex items-center justify-center">
                      {isLeftToRight ? (
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="text-muted-foreground">{msg.source_port}</span>
                        </div>
                      ) : (
                        <div className="w-full h-0.5 bg-gradient-to-l from-success via-success/50 to-transparent relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-r-[6px] border-r-success border-b-[4px] border-b-transparent rotate-180" />
                        </div>
                      )}
                    </div>

                    {/* Destination Column */}
                    <div className="flex items-center justify-center">
                      {isLeftToRight ? (
                        <div className="w-full h-0.5 bg-gradient-to-r from-success via-success/50 to-transparent relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-success border-b-[4px] border-b-transparent" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="text-muted-foreground">{msg.dest_port}</span>
                        </div>
                      )}
                    </div>

                    {/* Comment */}
                    <div className="text-xs truncate">
                      <span className={getMessageColor(msg)}>
                        {extractComment(msg) || getMessageLabel(msg)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Raw Message */}
                  {isSelected && msg.content && (
                    <div className="px-4 pb-3 bg-muted/10">
                      <pre className="p-3 bg-background border border-border rounded text-[10px] overflow-auto font-mono text-foreground max-h-60">
                        {msg.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
