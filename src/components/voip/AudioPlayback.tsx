import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Volume2, AlertCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AudioPlaybackProps {
  sessionId: string;
}

export const AudioPlayback = ({ sessionId }: AudioPlaybackProps) => {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalls();
  }, [sessionId]);

  const loadCalls = async () => {
    try {
      const { data, error } = await supabase
        .from("call_metrics")
        .select("*")
        .eq("session_id", sessionId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error("Error loading calls:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-warning/50 bg-warning/10">
        <AlertCircle className="h-4 w-4 text-warning" />
        <AlertDescription>
          <strong>Audio Reconstruction Requires Real PCAP Parsing</strong>
          <p className="mt-2 text-sm">
            Currently, the system uses simulated data for demonstration. To enable audio playback:
          </p>
          <ul className="mt-2 text-sm list-disc list-inside space-y-1">
            <li>Real PCAP parsing must be implemented (replacing mock data generation)</li>
            <li>RTP stream extraction and reconstruction</li>
            <li>Codec decoding (G.711, G.729, Opus, etc.)</li>
            <li>Audio file generation (WAV format)</li>
          </ul>
          <p className="mt-2 text-sm">
            This feature requires server-side processing libraries like FFmpeg, libpcap, or specialized RTP libraries.
          </p>
        </AlertDescription>
      </Alert>

      {calls.length === 0 ? (
        <Card className="p-12 text-center glass-card">
          <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No calls available for audio playback</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => (
            <Card key={call.id} className="p-6 glass-card">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">Call: {call.call_id}</h4>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{call.source_ip} → {call.dest_ip}</span>
                      <span>Codec: {call.codec || 'Unknown'}</span>
                      <span>Duration: {call.duration ? `${call.duration}s` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Outbound Audio (placeholder) */}
                  <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Outbound Audio</span>
                      <span className="text-xs text-muted-foreground">Not Available</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" disabled>
                        <Play className="w-4 h-4" />
                      </Button>
                      <Slider
                        disabled
                        value={[0]}
                        max={100}
                        step={1}
                        className="flex-1 opacity-50"
                      />
                      <span className="text-xs text-muted-foreground">0:00 / 0:00</span>
                    </div>
                    <Button size="sm" variant="ghost" className="w-full" disabled>
                      <Download className="w-4 h-4 mr-2" />
                      Export WAV
                    </Button>
                  </div>

                  {/* Inbound Audio (placeholder) */}
                  <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Inbound Audio</span>
                      <span className="text-xs text-muted-foreground">Not Available</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" disabled>
                        <Play className="w-4 h-4" />
                      </Button>
                      <Slider
                        disabled
                        value={[0]}
                        max={100}
                        step={1}
                        className="flex-1 opacity-50"
                      />
                      <span className="text-xs text-muted-foreground">0:00 / 0:00</span>
                    </div>
                    <Button size="sm" variant="ghost" className="w-full" disabled>
                      <Download className="w-4 h-4 mr-2" />
                      Export WAV
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                  <AlertCircle className="w-4 h-4" />
                  <span>Audio reconstruction requires real PCAP parsing implementation</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
