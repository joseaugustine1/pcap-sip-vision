-- Add audio extraction support columns to call_metrics
ALTER TABLE call_metrics
ADD COLUMN outbound_audio_path TEXT,
ADD COLUMN inbound_audio_path TEXT,
ADD COLUMN audio_extraction_status TEXT DEFAULT 'pending',
ADD COLUMN audio_extraction_error TEXT,
ADD COLUMN audio_extracted_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient status queries
CREATE INDEX idx_call_metrics_audio_status ON call_metrics(audio_extraction_status);

-- Add comments for documentation
COMMENT ON COLUMN call_metrics.outbound_audio_path IS 'Storage path for source->dest audio (WAV)';
COMMENT ON COLUMN call_metrics.inbound_audio_path IS 'Storage path for dest->source audio (WAV)';
COMMENT ON COLUMN call_metrics.audio_extraction_status IS 'Status: pending, completed, failed, unsupported, no_audio_data';

-- Create private audio files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files',
  false,
  52428800,
  ARRAY['audio/wav', 'audio/x-wav']::text[]
);

-- RLS: Users can insert audio for their own sessions
CREATE POLICY "Users can insert audio for own sessions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM analysis_sessions WHERE user_id = auth.uid()
  )
);

-- RLS: Users can view audio from their own sessions
CREATE POLICY "Users can select audio from own sessions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM analysis_sessions WHERE user_id = auth.uid()
  )
);

-- RLS: Service role has full access (for edge function)
CREATE POLICY "Service role full access to audio files"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'audio-files')
WITH CHECK (bucket_id = 'audio-files');