import { useState } from "react";
import { UploadSection } from "@/components/voip/UploadSection";
import { SessionList } from "@/components/voip/SessionList";
import { SessionDetails } from "@/components/voip/SessionDetails";
import { Activity } from "lucide-react";

const Index = () => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">VoIP Analyzer</h1>
              <p className="text-sm text-muted-foreground">Professional PCAP Analysis & Troubleshooting</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Upload Section */}
          <UploadSection />

          {/* Sessions Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Session List */}
            <div className="lg:col-span-1">
              <SessionList 
                selectedSessionId={selectedSessionId} 
                onSelectSession={setSelectedSessionId} 
              />
            </div>

            {/* Session Details */}
            <div className="lg:col-span-2">
              {selectedSessionId ? (
                <SessionDetails sessionId={selectedSessionId} />
              ) : (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-muted-foreground" />
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
