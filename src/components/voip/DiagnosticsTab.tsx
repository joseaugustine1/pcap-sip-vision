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

    // Analyze SIP error codes
    const sipErrors = sip.filter(m => 
      m.status_code && (
        m.status_code === 487 || 
        m.status_code === 480 || 
        m.status_code === 408 ||
        m.status_code === 503 ||
        m.status_code >= 400
      )
    );

    sipErrors.forEach(error => {
      let title = "SIP Error";
      let description = `Status code ${error.status_code}`;
      
      if (error.status_code === 487) {
        title = "Request Terminated";
        description = "Call was terminated before completion (487 Response)";
      } else if (error.status_code === 480) {
        title = "Temporarily Unavailable";
        description = "Destination was temporarily unavailable";
      } else if (error.status_code === 408) {
        title = "Request Timeout";
        description = "SIP request timed out";
      } else if (error.status_code === 503) {
        title = "Service Unavailable";
        description = "SIP service unavailable";
      }

      issues.push({
        id: `sip-error-${error.id}`,
        severity: error.status_code >= 500 ? 'critical' : 'warning',
        category: 'SIP Protocol',
        title,
        description,
        affectedCalls: [error.call_id || 'unknown'],
        timestamp: error.timestamp
      });
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
        description: `${failedRegisters.length} registration attempt(s) failed`,
        affectedCalls: failedRegisters.map(m => m.call_id || 'N/A'),
      });
    }

    // Analyze call quality issues
    calls.forEach(call => {
      // High packet loss
      if (call.packets_lost && call.packets_sent) {
        const packetLossRate = (call.packets_lost / call.packets_sent) * 100;
        if (packetLossRate > 5) {
          issues.push({
            id: `packet-loss-${call.id}`,
            severity: packetLossRate > 10 ? 'critical' : 'warning',
            category: 'Network Quality',
            title: 'High Packet Loss',
            description: `${packetLossRate.toFixed(2)}% packet loss detected`,
            affectedCalls: [call.call_id],
          });
        }
      }

      // High jitter
      if (call.avg_jitter && call.avg_jitter > 30) {
        issues.push({
          id: `jitter-${call.id}`,
          severity: call.avg_jitter > 50 ? 'critical' : 'warning',
          category: 'Network Quality',
          title: 'High Jitter',
          description: `Average jitter of ${call.avg_jitter.toFixed(2)}ms exceeds threshold`,
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
          description: `Average latency of ${call.avg_latency.toFixed(2)}ms detected`,
          affectedCalls: [call.call_id],
        });
      }

      // Poor MOS score
      if (call.mos_score && call.mos_score < 3.5) {
        issues.push({
          id: `mos-${call.id}`,
          severity: call.mos_score < 2.5 ? 'critical' : 'warning',
          category: 'Call Quality',
          title: 'Poor Voice Quality',
          description: `MOS score of ${call.mos_score.toFixed(2)} indicates quality issues`,
          affectedCalls: [call.call_id],
        });
      }
    });

    // Analyze call setup delays
    const inviteMessages = sip.filter(m => m.method === 'INVITE');
    inviteMessages.forEach(invite => {
      const response200 = sip.find(m => 
        m.call_id === invite.call_id && 
        m.status_code === 200 &&
        new Date(m.timestamp) > new Date(invite.timestamp)
      );

      if (response200) {
        const setupTime = new Date(response200.timestamp).getTime() - new Date(invite.timestamp).getTime();
        if (setupTime > 3000) { // More than 3 seconds
          issues.push({
            id: `setup-delay-${invite.id}`,
            severity: setupTime > 5000 ? 'warning' : 'info',
            category: 'Call Setup',
            title: 'Slow Call Setup',
            description: `Call setup took ${(setupTime / 1000).toFixed(2)}s (INVITE → 200 OK)`,
            affectedCalls: [invite.call_id || 'unknown'],
            timestamp: invite.timestamp
          });
        }
      }
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
