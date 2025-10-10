-- =====================================================
-- CRITICAL SECURITY FIXES
-- =====================================================

-- Fix 1: Restrict profiles table access to authenticated users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Fix 2: Make analysis_sessions.user_id NOT NULL
-- First check if there are any NULL values and handle them
DELETE FROM public.analysis_sessions WHERE user_id IS NULL;

-- Now add NOT NULL constraint
ALTER TABLE public.analysis_sessions 
ALTER COLUMN user_id SET NOT NULL;

-- Add trigger to prevent NULL user_id
CREATE OR REPLACE FUNCTION prevent_null_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_user_id_not_null
BEFORE INSERT OR UPDATE ON public.analysis_sessions
FOR EACH ROW
EXECUTE FUNCTION prevent_null_user_id();

-- Fix 3: Create explicit storage RLS policies for PCAP files
-- Users can only upload to their own session folders
CREATE POLICY "Users can upload PCAP files to own sessions"
ON storage.objects 
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pcap-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM analysis_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Users can only download PCAP files from their own sessions
CREATE POLICY "Users can download own PCAP files"
ON storage.objects 
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pcap-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM analysis_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Users can only delete PCAP files from their own sessions
CREATE POLICY "Users can delete own PCAP files"
ON storage.objects 
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pcap-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM analysis_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Prevent UPDATE operations (files should be immutable)
CREATE POLICY "Prevent PCAP file modifications"
ON storage.objects 
FOR UPDATE
TO authenticated
USING (false);

-- Verify bucket is private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'pcap-files';