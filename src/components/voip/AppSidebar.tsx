import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Loader2, Trash2, Download, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { mapError, logError } from '@/lib/errorHandler';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

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

interface AppSidebarProps {
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  refreshTrigger: number;
}

export function AppSidebar({ selectedSessionId, onSelectSession, refreshTrigger }: AppSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { open } = useSidebar();

  const getSessionColor = (sessionId: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
    ];
    const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

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
  }, [refreshTrigger]);

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

  const handleDownload = async (sessionId: string, sessionName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: pcapFiles, error: filesError } = await supabase
        .from('pcap_files')
        .select('*')
        .eq('session_id', sessionId);

      if (filesError) throw filesError;

      if (!pcapFiles || pcapFiles.length === 0) {
        toast({
          title: "No files found",
          description: "This session has no PCAP files to download.",
          variant: "destructive",
        });
        return;
      }

      for (const file of pcapFiles) {
        const { data, error } = await supabase.storage
          .from('pcap-files')
          .download(file.file_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Download started",
        description: `Downloading ${pcapFiles.length} PCAP file(s)`,
      });
    } catch (error: any) {
      const { data: { user } } = await supabase.auth.getUser();
      logError('download-pcap', error, user?.id);
      
      const { message } = mapError(error);
      toast({
        title: "Download Failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session? This will also delete all associated PCAP files and analysis data.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('analysis_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session deleted",
        description: "The session and all associated data have been removed.",
      });

      loadSessions();
      if (selectedSessionId === sessionId) {
        onSelectSession('');
      }
    } catch (error: any) {
      const { data: { user } } = await supabase.auth.getUser();
      logError('delete-session', error, user?.id);
      
      const { message } = mapError(error);
      toast({
        title: "Delete Failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {open && <span>Analysis Sessions</span>}
          </SidebarGroupLabel>
          {open && (
            <div className="px-2 pb-2">
              <p className="text-xs text-muted-foreground">{sessions.length} total sessions</p>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sessions.length === 0 ? (
                open && (
                  <div className="text-center py-8 px-4 text-muted-foreground">
                    <p className="text-sm">No sessions yet</p>
                    <p className="text-xs mt-1">Upload PCAP files to get started</p>
                  </div>
                )
              ) : (
                <div className="space-y-2 px-2">
                  {sessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <button
                        onClick={() => onSelectSession(session.id)}
                        className={`relative p-3 rounded-lg border transition-all w-full text-left ${
                          selectedSessionId === session.id
                            ? "bg-primary/10 border-primary shadow-md"
                            : "bg-background/50 border-border hover:border-primary/50 hover:shadow-sm"
                        }`}
                      >
                        {open ? (
                          <>
                            <div className="pr-16">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-lg ${getSessionColor(session.id)} flex items-center justify-center text-white font-bold text-sm`}>
                                  {session.name.charAt(0).toUpperCase()}
                                </div>
                                <h4 className="font-medium text-sm text-foreground line-clamp-2 flex-1">
                                  {session.name}
                                </h4>
                              </div>

                              <div className="space-y-2">
                                <Badge variant="outline" className={`text-xs ${getStatusColor(session.status)}`}>
                                  {session.status}
                                </Badge>

                                {session.status === 'processing' && (
                                  <div className="text-xs text-muted-foreground animate-pulse">
                                    Analyzing PCAP files...
                                  </div>
                                )}

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
                            </div>

                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={(e) => handleDownload(session.id, session.name, e)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => handleDelete(session.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center">
                            <div className={`w-8 h-8 rounded-lg ${getSessionColor(session.id)} flex items-center justify-center text-white font-bold text-sm`}>
                              {session.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                      </button>
                    </SidebarMenuItem>
                  ))}
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
