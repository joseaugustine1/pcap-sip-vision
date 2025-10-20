import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/api";
import { UploadSection } from "@/components/voip/UploadSection";
import { SessionDetails } from "@/components/voip/SessionDetails";
import { UserProfile } from "@/components/voip/UserProfile";
import { AppSidebar } from "@/components/voip/AppSidebar";
import { Activity, Terminal, Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const Index = () => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      console.log('[Index] Auth state changed:', event, session ? 'has session' : 'no session');
      if (!session) {
        console.log('[Index] No session, redirecting to auth');
        setUser(null);
        setLoading(false);
        navigate("/auth");
      } else {
        console.log('[Index] Session found, user:', session.user);
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">
            {'>'} INITIALIZING SYSTEM...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar 
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          refreshTrigger={refreshTrigger}
        />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="border-b border-border glass-card sticky top-0 z-10">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                    <Terminal className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      VoIP <span className="text-primary">Analyzer</span>
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      PCAP Analysis & Network Troubleshooting
                    </p>
                  </div>
                </div>
                <UserProfile />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Upload Section */}
              <UploadSection onUploadComplete={handleUploadComplete} />

              {/* Session Details */}
              {selectedSessionId ? (
                <SessionDetails sessionId={selectedSessionId} />
              ) : (
                <div className="glass-card p-12 text-center rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center backdrop-blur-sm">
                    <Activity className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Session Selected</h3>
                  <p className="text-muted-foreground">Upload PCAP files or select a session from the sidebar to view analysis</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
