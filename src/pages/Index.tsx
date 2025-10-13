import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UploadSection } from "@/components/voip/UploadSection";
import { SessionList } from "@/components/voip/SessionList";
import { SessionDetails } from "@/components/voip/SessionDetails";
import { UserProfile } from "@/components/voip/UserProfile";
import { Activity, Terminal, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border glass-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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

      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Upload Section */}
          <UploadSection onUploadComplete={handleUploadComplete} />

          {/* Sessions Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Session List */}
            <div className="lg:col-span-1">
              <SessionList 
                key={refreshTrigger}
                selectedSessionId={selectedSessionId} 
                onSelectSession={setSelectedSessionId} 
              />
            </div>

            {/* Session Details */}
            <div className="lg:col-span-2">
              {selectedSessionId ? (
                <SessionDetails sessionId={selectedSessionId} />
              ) : (
                <div className="glass-card p-12 text-center rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center backdrop-blur-sm">
                    <Activity className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Session Selected</h3>
                  <p className="text-muted-foreground">Upload PCAP files or select a session to view analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
