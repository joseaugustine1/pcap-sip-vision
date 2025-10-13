import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Volume2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase
        .from("call_metrics")
        .select("*, outbound_audio_path, inbound_audio_path, audio_extraction_status, audio_extraction_error")
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const getSignedUrl = async () => {
      try {
        setLoading(true);
        const { data, error: urlError } = await supabase.storage
          .from('audio-files')
          .createSignedUrl(audioPath, 3600);
        
        if (urlError) throw urlError;
        if (data) setAudioUrl(data.signedUrl);
      } catch (err: any) {
        console.error('Failed to get audio URL:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    getSignedUrl();
  }, [audioPath]);
  
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
  
  if (error || !audioUrl) {
    return (
      <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-destructive">Load Failed</span>
        </div>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>
    );
  }
  
  return (
    <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-green-600 dark:text-green-400">Available</span>
      </div>
      
      <audio controls className="w-full h-10">
        <source src={audioUrl} type="audio/wav" />
        Your browser does not support audio playback.
      </audio>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(audioUrl, '_blank')}
        className="w-full"
      >
        <Download className="h-4 w-4 mr-2" />
        Download {direction} audio (WAV)
      </Button>
    </div>
  );
};
