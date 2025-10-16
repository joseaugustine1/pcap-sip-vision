import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Volume2, AlertCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

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
      const data = await apiClient.getCallMetrics(sessionId);
      setCalls(data || []);
    } catch (error) {
      console.error("Error loading calls:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
                      <span>Duration: {call.duration ? `${call.duration.toFixed(1)}s` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {call.outbound_audio_path ? (
                    <AudioPlayer 
                      audioPath={call.outbound_audio_path}
                      callId={call.id}
                      direction="outbound"
                      label="Outbound Audio (Source → Destination)"
                    />
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Outbound Audio</span>
                        <span className="text-xs text-muted-foreground">
                          {call.audio_extraction_status === 'pending' ? 'Processing...' : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  )}

                  {call.inbound_audio_path ? (
                    <AudioPlayer 
                      audioPath={call.inbound_audio_path}
                      callId={call.id}
                      direction="inbound"
                      label="Inbound Audio (Destination → Source)"
                    />
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Inbound Audio</span>
                        <span className="text-xs text-muted-foreground">
                          {call.audio_extraction_status === 'pending' ? 'Processing...' : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {call.audio_extraction_status === 'pending' && (
                  <Alert className="mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Extracting audio from RTP streams...</AlertDescription>
                  </Alert>
                )}

                {call.audio_extraction_status === 'failed' && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Audio extraction failed: {call.audio_extraction_error}
                    </AlertDescription>
                  </Alert>
                )}

                {call.audio_extraction_status === 'unsupported' && (
                  <Alert className="mt-4 border-warning/50 bg-warning/10">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-warning">
                      {call.audio_extraction_error}
                    </AlertDescription>
                  </Alert>
                )}

                {call.audio_extraction_status === 'no_audio_data' && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No RTP audio data found in PCAP for this call
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

interface AudioPlayerProps {
  audioPath: string;
  callId: string;
  direction: 'outbound' | 'inbound';
  label: string;
}

const AudioPlayer = ({ audioPath, callId, direction, label }: AudioPlayerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(false);
  }, []);
  
  if (loading) {
    return (
      <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Not Available</span>
      </div>
      <p className="text-xs text-muted-foreground">Audio playback coming soon</p>
    </div>
  );
};
