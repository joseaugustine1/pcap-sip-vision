import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity,
  TrendingUp,
  Network,
  Radio
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DiagnosticsTabProps {
  sessionId: string;
}

interface DiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affectedCalls: string[];
  timestamp?: string;
}

export const DiagnosticsTab = ({ sessionId }: DiagnosticsTabProps) => {
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [sipMessages, setSipMessages] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnosticData();
  }, [sessionId]);

  const loadDiagnosticData = async () => {
    try {
      // Load SIP messages
      const { data: sipData } = await supabase
        .from("sip_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("timestamp", { ascending: true });

      // Load call metrics
      const { data: callsData } = await supabase
        .from("call_metrics")
        .select("*")
        .eq("session_id", sessionId);

      setSipMessages(sipData || []);
      setCalls(callsData || []);

      // Analyze issues
      const detectedIssues = analyzeIssues(sipData || [], callsData || []);
      setIssues(detectedIssues);
    } catch (error) {
      console.error("Error loading diagnostics:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeIssues = (sip: any[], calls: any[]): DiagnosticIssue[] => {
    const issues: DiagnosticIssue[] = [];

    // Group SIP messages by call_id for advanced analysis
    const callGroups = new Map<string, any[]>();
    sip.forEach(msg => {
      const callId = msg.call_id || 'unknown';
      if (!callGroups.has(callId)) {
        callGroups.set(callId, []);
      }
      callGroups.get(callId)!.push(msg);
    });

    // ==============================
    // SIP-LEVEL ISSUES
    // ==============================

    // SIP_408_TIMEOUT: INVITE received 100 Trying but no final response
    sip.filter(m => m.method === 'INVITE').forEach(invite => {
      const callMessages = callGroups.get(invite.call_id) || [];
      const trying100 = callMessages.find(m => m.status_code === 100);
      const finalResponse = callMessages.find(m => 
        m.status_code && m.status_code >= 200 && 
        new Date(m.timestamp) > new Date(invite.timestamp)
      );
      
      if (trying100 && !finalResponse) {
        const timeSince = Date.now() - new Date(invite.timestamp).getTime();
        if (timeSince > 5000) {
          issues.push({
            id: `sip-408-timeout-${invite.id}`,
            severity: 'critical',
            category: 'SIP Protocol',
            title: 'SIP Timeout – No Response',
            description: 'INVITE received 100 Trying but no final response within expected window. Call setup delay or failure due to network timeout.',
            affectedCalls: [invite.call_id || 'unknown'],
            timestamp: invite.timestamp
          });
        }
      }
    });

    // SIP_487_SELF_CALL: 487 with same caller and callee
    sip.filter(m => m.status_code === 487).forEach(response => {
      const callMessages = callGroups.get(response.call_id) || [];
      const invite = callMessages.find(m => m.method === 'INVITE');
      
      if (invite && invite.content) {
        const fromMatch = invite.content.match(/From:.*?sip:([^@;>\s]+)/i);
        const toMatch = invite.content.match(/To:.*?sip:([^@;>\s]+)/i);
        
        if (fromMatch && toMatch && fromMatch[1] === toMatch[1]) {
          issues.push({
            id: `sip-487-self-call-${response.id}`,
            severity: 'warning',
            category: 'SIP Protocol',
            title: 'Caller Cannot Call Self',
            description: 'SIP 487 received due to same caller and callee number. Inbound call redirected to same number. Self-call rejection by Microsoft Teams or PBX.',
            affectedCalls: [response.call_id || 'unknown'],
            timestamp: response.timestamp
          });
        } else {
          issues.push({
            id: `sip-487-terminated-${response.id}`,
            severity: 'warning',
            category: 'SIP Protocol',
            title: 'Request Terminated',
            description: 'Call was terminated before completion (487 Response)',
            affectedCalls: [response.call_id || 'unknown'],
            timestamp: response.timestamp
          });
        }
      }
    });

    // SIP_403_FORBIDDEN: Authentication / Permission Issue
    sip.filter(m => m.status_code === 403).forEach(error => {
      issues.push({
        id: `sip-403-forbidden-${error.id}`,
        severity: 'critical',
        category: 'Authentication',
        title: 'Authentication / Permission Issue',
        description: 'Call rejected with SIP 403 Forbidden. Authentication failure or blocked by trunk policy.',
        affectedCalls: [error.call_id || 'unknown'],
        timestamp: error.timestamp
      });
    });

    // SIP_480_TEMP_UNAVAILABLE: Callee Temporarily Unavailable
    sip.filter(m => m.status_code === 480).forEach(error => {
      issues.push({
        id: `sip-480-unavailable-${error.id}`,
        severity: 'warning',
        category: 'SIP Protocol',
        title: 'Callee Temporarily Unavailable',
        description: 'Callee endpoint or device not registered / unreachable. End device not reachable or no registration at time of call.',
        affectedCalls: [error.call_id || 'unknown'],
        timestamp: error.timestamp
      });
    });

    // SIP_488_CODEC_MISMATCH: Codec Negotiation Failed
    sip.filter(m => m.status_code === 488).forEach(error => {
      issues.push({
        id: `sip-488-codec-${error.id}`,
        severity: 'critical',
        category: 'Media Negotiation',
        title: 'Codec Negotiation Failed',
        description: 'Offer/Answer SDP codec mismatch or unsupported codec. Endpoint could not agree on codec. Call setup fails.',
        affectedCalls: [error.call_id || 'unknown'],
        timestamp: error.timestamp
      });
    });

    // BYE_MISSING: Improper Call Teardown
    callGroups.forEach((messages, callId) => {
      const has200OK = messages.some(m => m.status_code === 200 && m.method !== 'BYE');
      const hasBye = messages.some(m => m.method === 'BYE');
      
      if (has200OK && !hasBye) {
        issues.push({
          id: `bye-missing-${callId}`,
          severity: 'info',
          category: 'SIP Protocol',
          title: 'Improper Call Teardown',
          description: 'BYE message missing; call not gracefully terminated. Possible transport interruption or abnormal disconnect.',
          affectedCalls: [callId]
        });
      }
    });

    // Check for registration failures
    const registerMessages = sip.filter(m => m.method === 'REGISTER');
    const failedRegisters = registerMessages.filter(m => 
      m.status_code && m.status_code >= 400
    );

    if (failedRegisters.length > 0) {
      issues.push({
        id: 'registration-failures',
        severity: 'critical',
        category: 'Authentication',
        title: 'Registration Failures Detected',
        description: `${failedRegisters.length} registration attempt(s) failed. Authentication or configuration issue preventing registration.`,
        affectedCalls: failedRegisters.map(m => m.call_id || 'N/A'),
      });
    }

    // ==============================
    // RTP / MEDIA-LEVEL ISSUES
    // ==============================

    calls.forEach(call => {
      // RTP_PACKETLOSS_HIGH: > 3% packet loss
      if (call.packets_lost && call.packets_sent) {
        const packetLossRate = (call.packets_lost / call.packets_sent) * 100;
        if (packetLossRate > 3) {
          issues.push({
            id: `rtp-packet-loss-${call.id}`,
            severity: packetLossRate > 10 ? 'critical' : 'warning',
            category: 'Network Quality',
            title: 'High Packet Loss',
            description: `Detected RTP packet loss ${packetLossRate.toFixed(2)}% (threshold: 3%). Network instability or congestion affecting audio quality.`,
            affectedCalls: [call.call_id],
          });
        }
      }

      // RTP_JITTER_SPIKE: > 50ms jitter
      if (call.avg_jitter && call.avg_jitter > 50) {
        issues.push({
          id: `rtp-jitter-spike-${call.id}`,
          severity: 'warning',
          category: 'Network Quality',
          title: 'High Jitter Detected',
          description: `RTP jitter ${call.avg_jitter.toFixed(2)}ms exceeds threshold (50ms). Possible Wi-Fi instability, routing issue, or buffer underrun.`,
          affectedCalls: [call.call_id],
        });
      }

      // RTP_ONE_WAY_AUDIO: Packets only in one direction
      const hasOutbound = call.packets_sent && call.packets_sent > 0;
      const hasInbound = call.packets_received && call.packets_received > 0;
      
      if ((hasOutbound && !hasInbound) || (!hasOutbound && hasInbound)) {
        issues.push({
          id: `rtp-one-way-audio-${call.id}`,
          severity: 'critical',
          category: 'Media Flow',
          title: 'One-Way Audio Detected',
          description: `RTP seen in ${hasOutbound ? 'outbound' : 'inbound'} direction only. Likely NAT or firewall issue blocking ${hasOutbound ? 'inbound' : 'outbound'} media.`,
          affectedCalls: [call.call_id],
        });
      }

      // NAT_PRIVATE_IP: Check for private IPs in SDP
      const isPrivateIP = (ip: string) => {
        return ip?.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/);
      };

      if ((isPrivateIP(call.source_ip) || isPrivateIP(call.dest_ip)) && 
          ((hasOutbound && !hasInbound) || (!hasOutbound && hasInbound))) {
        issues.push({
          id: `nat-private-ip-${call.id}`,
          severity: 'critical',
          category: 'NAT/Firewall',
          title: 'Possible NAT Issue',
          description: `SDP contains private IP (${call.source_ip || call.dest_ip}) while peer expects public IP. Private IP in SDP leads to unreachable media path.`,
          affectedCalls: [call.call_id],
        });
      }

      // RTP_SILENCE_OR_NO_MEDIA: No packets detected
      if ((!call.packets_sent || call.packets_sent === 0) && 
          (!call.packets_received || call.packets_received === 0)) {
        issues.push({
          id: `rtp-no-media-${call.id}`,
          severity: 'warning',
          category: 'Media Flow',
          title: 'No RTP Media Flow',
          description: 'No RTP packets detected after 200 OK. Endpoint answered but did not start media stream.',
          affectedCalls: [call.call_id],
        });
      }

      // High latency
      if (call.avg_latency && call.avg_latency > 150) {
        issues.push({
          id: `latency-${call.id}`,
          severity: call.avg_latency > 300 ? 'critical' : 'warning',
          category: 'Network Quality',
          title: 'High Latency',
          description: `Average latency of ${call.avg_latency.toFixed(2)}ms detected. May cause audio delays and poor user experience.`,
          affectedCalls: [call.call_id],
        });
      }

      // ==============================
      // QUALITY & TIMING
      // ==============================

      // MOS_LOW_SCORE: MOS < 3.5
      if (call.mos_score && call.mos_score < 3.5) {
        issues.push({
          id: `mos-low-score-${call.id}`,
          severity: call.mos_score < 2.5 ? 'critical' : 'warning',
          category: 'Call Quality',
          title: 'Low MOS Detected',
          description: `Calculated MOS ${call.mos_score.toFixed(2)} (threshold: 3.5) indicates poor call quality. User experience degradation due to network performance.`,
          affectedCalls: [call.call_id],
        });
      }
    });

    // CALL_SETUP_DELAY: INVITE to 200 OK > 3s
    const inviteMessages = sip.filter(m => m.method === 'INVITE');
    inviteMessages.forEach(invite => {
      const response200 = sip.find(m => 
        m.call_id === invite.call_id && 
        m.status_code === 200 &&
        new Date(m.timestamp) > new Date(invite.timestamp)
      );

      if (response200) {
        const setupTime = new Date(response200.timestamp).getTime() - new Date(invite.timestamp).getTime();
        if (setupTime > 3000) {
          issues.push({
            id: `call-setup-delay-${invite.id}`,
            severity: setupTime > 5000 ? 'warning' : 'info',
            category: 'Call Setup',
            title: 'High Call Setup Delay',
            description: `INVITE to 200 OK time ${(setupTime / 1000).toFixed(2)}s exceeds threshold (3s). Slow SIP signalling or backend response.`,
            affectedCalls: [invite.call_id || 'unknown'],
            timestamp: invite.timestamp
          });
        }
      }
    });

    // ==============================
    // SDP & NEGOTIATION
    // ==============================

    // SDP_INVALID_CONNECTION_INFO & SDP_DIRECTION_MISMATCH
    sip.filter(m => m.content && m.content.includes('v=0')).forEach(msg => {
      const sdp = msg.content;
      
      // Check for missing connection info
      if (!sdp.match(/c=IN IP[46]/)) {
        issues.push({
          id: `sdp-invalid-connection-${msg.id}`,
          severity: 'warning',
          category: 'Media Negotiation',
          title: 'Invalid SDP Connection Info',
          description: 'SDP missing or malformed c=IN IP4/IP6 line. Malformed SDP prevents proper media setup.',
          affectedCalls: [msg.call_id || 'unknown'],
          timestamp: msg.timestamp
        });
      }

      // Check for conflicting media directions
      const sendrecvMatch = sdp.match(/a=(sendrecv|sendonly|recvonly|inactive)/g);
      if (sendrecvMatch && sendrecvMatch.length > 1) {
        const directions = sendrecvMatch.map(m => m.split('=')[1]);
        const hasConflict = directions.includes('sendonly') && directions.includes('recvonly');
        
        if (hasConflict) {
          issues.push({
            id: `sdp-direction-mismatch-${msg.id}`,
            severity: 'info',
            category: 'Media Negotiation',
            title: 'SDP Media Direction Conflict',
            description: 'Offer/Answer contain conflicting sendrecv attributes. One-way audio or muted media stream likely.',
            affectedCalls: [msg.call_id || 'unknown'],
            timestamp: msg.timestamp
          });
        }
      }
    });

    // Other SIP error codes
    sip.filter(m => m.status_code && m.status_code >= 400 && 
               ![403, 408, 480, 487, 488].includes(m.status_code)).forEach(error => {
      issues.push({
        id: `sip-error-${error.id}`,
        severity: error.status_code >= 500 ? 'critical' : 'warning',
        category: 'SIP Protocol',
        title: `SIP Error ${error.status_code}`,
        description: `SIP response code ${error.status_code} indicates call failure or issue.`,
        affectedCalls: [error.call_id || 'unknown'],
        timestamp: error.timestamp
      });
    });

    return issues;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <CheckCircle className="w-4 h-4 text-info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-info/10 text-info border-info/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'SIP Protocol':
        return <Radio className="w-4 h-4" />;
      case 'Network Quality':
        return <Network className="w-4 h-4" />;
      case 'Call Setup':
        return <Clock className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 glass-card border-destructive/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-2xl font-bold text-destructive">{criticalIssues.length}</p>
            </div>
            <XCircle className="w-8 h-8 text-destructive opacity-20" />
          </div>
        </Card>

        <Card className="p-4 glass-card border-warning/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-bold text-warning">{warningIssues.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-warning opacity-20" />
          </div>
        </Card>

        <Card className="p-4 glass-card border-success/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-2xl font-bold text-success">{calls.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-success opacity-20" />
          </div>
        </Card>
      </div>

      {/* Issues List */}
      <Card className="glass-card">
        <Tabs defaultValue="all" className="w-full">
          <div className="border-b border-border px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="all">All Issues ({issues.length})</TabsTrigger>
              <TabsTrigger value="critical">Critical ({criticalIssues.length})</TabsTrigger>
              <TabsTrigger value="warnings">Warnings ({warningIssues.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="p-6">
            {issues.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">No Issues Detected</p>
                <p className="text-sm text-muted-foreground mt-2">All calls appear healthy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map(issue => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg border bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getSeverityIcon(issue.severity)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-foreground">{issue.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                          </div>
                          <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {getCategoryIcon(issue.category)}
                            <span>{issue.category}</span>
                          </div>
                          {issue.affectedCalls.length > 0 && (
                            <span>Calls: {issue.affectedCalls.slice(0, 3).join(', ')}{issue.affectedCalls.length > 3 ? '...' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="critical" className="p-6">
            {criticalIssues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No critical issues found
              </div>
            ) : (
              <div className="space-y-3">
                {criticalIssues.map(issue => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg border border-destructive/20 bg-destructive/5"
                  >
                    <div className="flex items-start gap-4">
                      <XCircle className="w-5 h-5 text-destructive mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{issue.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="warnings" className="p-6">
            {warningIssues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No warnings found
              </div>
            ) : (
              <div className="space-y-3">
                {warningIssues.map(issue => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg border border-warning/20 bg-warning/5"
                  >
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="w-5 h-5 text-warning mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{issue.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
