import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Radio } from "lucide-react";
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

interface LadderEvent {
  id: string;
  timestamp: Date;
  source_ip: string;
  source_port: number;
  dest_ip: string;
  dest_port: number;
  type: 'sip' | 'rtp_start' | 'rtp_end';
  label: string;
  method?: string;
  status_code?: number;
  content?: string;
  userAgent?: string;
}

export const SipLadder = ({ sessionId }: SipLadderProps) => {
  const [events, setEvents] = useState<LadderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [uniqueIps, setUniqueIps] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [sourceUserAgent, setSourceUserAgent] = useState<string>("");
  const [destUserAgent, setDestUserAgent] = useState<string>("");

  useEffect(() => {
    loadLadderData();
  }, [sessionId]);

  const loadLadderData = async () => {
    try {
      setLoading(true);

      // Get SIP messages
      const { data: sipData, error: sipError } = await supabase
        .from("sip_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("timestamp", { ascending: true });

      if (sipError) throw sipError;

      // Get RTP call data
      const { data: callData, error: callError } = await supabase
        .from("call_metrics")
        .select("*")
        .eq("session_id", sessionId);

      if (callError) throw callError;

      const allEvents: LadderEvent[] = [];
      const ips = new Set<string>();

      // Extract User-Agent from SIP messages
      let srcAgent = "";
      let dstAgent = "";

      // Add SIP messages as events
      sipData?.forEach((msg) => {
        ips.add(msg.source_ip);
        ips.add(msg.dest_ip);

        // Extract User-Agent
        if (msg.content) {
          const uaMatch = msg.content.match(/User-Agent:\s*(.+?)(?:\r?\n|$)/i);
          if (uaMatch) {
            const agent = uaMatch[1].trim();
            if (!srcAgent && msg.source_ip) srcAgent = agent;
            if (!dstAgent && msg.dest_ip && msg.dest_ip !== msg.source_ip) dstAgent = agent;
          }
        }

        allEvents.push({
          id: msg.id,
          timestamp: new Date(msg.timestamp),
          source_ip: msg.source_ip,
          source_port: msg.source_port,
          dest_ip: msg.dest_ip,
          dest_port: msg.dest_port,
          type: 'sip',
          label: msg.method || `${msg.status_code}`,
          method: msg.method || undefined,
          status_code: msg.status_code || undefined,
          content: msg.content || undefined,
        });
      });

      setSourceUserAgent(srcAgent);
      setDestUserAgent(dstAgent);

      // Add RTP start/end events
      callData?.forEach((call) => {
        ips.add(call.source_ip);
        ips.add(call.dest_ip);

        if (call.start_time) {
          allEvents.push({
            id: `rtp-start-${call.id}`,
            timestamp: new Date(call.start_time),
            source_ip: call.source_ip,
            source_port: 0,
            dest_ip: call.dest_ip,
            dest_port: 0,
            type: 'rtp_start',
            label: `RTP Start (${call.codec})`,
          });
        }

        if (call.end_time) {
          allEvents.push({
            id: `rtp-end-${call.id}`,
            timestamp: new Date(call.end_time),
            source_ip: call.source_ip,
            source_port: 0,
            dest_ip: call.dest_ip,
            dest_port: 0,
            type: 'rtp_end',
            label: 'RTP End',
          });
        }
      });

      // Sort all events by timestamp
      allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setEvents(allEvents);
      setUniqueIps(Array.from(ips));
    } catch (error) {
      console.error("Error loading ladder data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (event: LadderEvent) => {
    if (event.type === 'rtp_start' || event.type === 'rtp_end') return "text-info";
    if (event.method === "INVITE") return "text-primary";
    if (event.method === "ACK") return "text-success";
    if (event.method === "BYE") return "text-destructive";
    if (event.status_code) {
      if (event.status_code >= 200 && event.status_code < 300) return "text-success";
      if (event.status_code >= 400) return "text-destructive";
      return "text-warning";
    }
    return "text-muted-foreground";
  };

  const getStatusDescription = (code: number): string => {
    const descriptions: { [key: number]: string } = {
      100: "Trying",
      180: "Ringing",
      181: "Call Forwarded",
      182: "Queued",
      183: "Session Progress",
      200: "OK",
      202: "Accepted",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      407: "Proxy Auth Required",
      408: "Request Timeout",
      480: "Temporarily Unavailable",
      481: "Call/Transaction Does Not Exist",
      486: "Busy Here",
      487: "Request Terminated",
      488: "Not Acceptable Here",
      500: "Server Internal Error",
      503: "Service Unavailable",
      600: "Busy Everywhere",
      603: "Decline",
      604: "Does Not Exist Anywhere",
    };
    return descriptions[code] || "Unknown";
  };

  const getEventLabel = (event: LadderEvent) => {
    if (event.type === 'rtp_start' || event.type === 'rtp_end') {
      return event.label;
    }
    if (event.method) return event.method;
    if (event.status_code) {
      const description = getStatusDescription(event.status_code);
      return `${event.status_code} - ${description}`;
    }
    return event.label;
  };

  const extractComment = (event: LadderEvent) => {
    if (event.type === 'rtp_start') return "Media stream started";
    if (event.type === 'rtp_end') return "Media stream ended";
    if (!event.content) return "";
    
    // Extract From header for comment
    const fromMatch = event.content.match(/From:\s*(.+)/i);
    
    let comment = "";
    if (event.method) {
      comment = `SIP ${event.method}`;
      if (fromMatch) comment += ` From: ${fromMatch[1].split('\n')[0].trim()}`;
    } else if (event.status_code) {
      comment = `SIP Status ${event.status_code}`;
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

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No signaling data available yet</p>
        <p className="text-sm text-muted-foreground mt-1">Analysis in progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* IP and Agent Info Header */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 glass-card">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Radio className="w-4 h-4 text-primary" />
              <span>Source</span>
            </div>
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-foreground">{uniqueIps[0]}</span>
                <IpLookupBadge ip={uniqueIps[0]} />
              </div>
              {sourceUserAgent && (
                <p className="text-[10px] text-muted-foreground">Agent: {sourceUserAgent}</p>
              )}
            </div>
          </div>
        </Card>
        
        <Card className="p-4 glass-card">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Radio className="w-4 h-4 text-primary" />
              <span>Destination</span>
            </div>
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-foreground">{uniqueIps[1]}</span>
                <IpLookupBadge ip={uniqueIps[1]} />
              </div>
              {destUserAgent && (
                <p className="text-[10px] text-muted-foreground">Agent: {destUserAgent}</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* SIP/RTP Ladder - Wireshark Style */}
      <div className="border border-border rounded-lg bg-background/50 overflow-hidden">
        {/* Header with IP addresses */}
        <div className="grid grid-cols-[140px_1fr_200px] gap-4 p-3 bg-muted/30 border-b border-border text-xs font-mono">
          <div className="font-semibold">Time</div>
          <div className="font-semibold text-center grid grid-cols-[1fr_auto_1fr] items-center">
            <span className="text-right">{uniqueIps[0] || "Source"}</span>
            <span className="px-8"></span>
            <span className="text-left">{uniqueIps[1] || "Destination"}</span>
          </div>
          <div className="font-semibold">Comment</div>
        </div>

        {/* Event rows */}
        <ScrollArea className="max-h-[600px]">
          <div className="divide-y divide-border/50">
            {events.map((event) => {
              const sourceIndex = uniqueIps.indexOf(event.source_ip);
              const destIndex = uniqueIps.indexOf(event.dest_ip);
              const isLeftToRight = sourceIndex < destIndex;
              const isSelected = selectedEvent === event.id;
              const isRtpEvent = event.type === 'rtp_start' || event.type === 'rtp_end';

              return (
                <div key={event.id} className={`hover:bg-muted/20 transition-colors ${isRtpEvent ? 'bg-info/5' : ''}`}>
                  <div
                    className="grid grid-cols-[140px_1fr_200px] gap-4 p-2 cursor-pointer"
                    onClick={() => event.content && setSelectedEvent(isSelected ? null : event.id)}
                  >
                    {/* Timestamp */}
                    <div className="text-xs font-mono text-muted-foreground">
                      {format(event.timestamp, "yyyy-MM-dd HH:mm:ss.SSS")}
                    </div>

                    {/* Arrow and Label in Center */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      {/* Source Port */}
                      <div className="text-right">
                        {isLeftToRight && event.source_port > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground">{event.source_port}</span>
                        )}
                      </div>

                      {/* Center: Arrow with Label */}
                      <div className="flex items-center justify-center min-w-[200px] px-2">
                        {isRtpEvent ? (
                          <div className="flex items-center gap-2">
                            <Radio className="w-3 h-3 text-info" />
                            <span className="text-xs font-medium text-info">{event.label}</span>
                          </div>
                        ) : (
                          <div className="relative flex items-center w-full">
                            {isLeftToRight ? (
                              <>
                                <div className="flex-1 h-0.5 bg-success" />
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 whitespace-nowrap">
                                  <span className={`text-xs font-medium ${getEventColor(event)}`}>
                                    {getEventLabel(event)}
                                  </span>
                                </div>
                                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-success border-b-[4px] border-b-transparent" />
                              </>
                            ) : (
                              <>
                                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-r-[6px] border-r-success border-b-[4px] border-b-transparent" />
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 whitespace-nowrap">
                                  <span className={`text-xs font-medium ${getEventColor(event)}`}>
                                    {getEventLabel(event)}
                                  </span>
                                </div>
                                <div className="flex-1 h-0.5 bg-success" />
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Destination Port */}
                      <div className="text-left">
                        {!isLeftToRight && event.dest_port > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground">{event.dest_port}</span>
                        )}
                      </div>
                    </div>

                    {/* Comment */}
                    <div className="text-xs truncate">
                      <span className="text-muted-foreground">
                        {extractComment(event)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Raw Message */}
                  {isSelected && event.content && (
                    <div className="px-4 pb-3 bg-muted/10">
                      <pre className="p-3 bg-background border border-border rounded text-[10px] overflow-auto font-mono text-foreground max-h-60">
                        {event.content}
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
