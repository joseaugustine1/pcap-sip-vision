-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to analysis_sessions
ALTER TABLE public.analysis_sessions
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing sessions to have a null user_id (they'll be orphaned)
-- In production, you'd migrate these properly

-- Update RLS policies for analysis_sessions
DROP POLICY IF EXISTS "Allow all access to analysis_sessions" ON public.analysis_sessions;

CREATE POLICY "Users can view own sessions"
  ON public.analysis_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.analysis_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.analysis_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.analysis_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update RLS policies for pcap_files (cascade from sessions)
DROP POLICY IF EXISTS "Allow all access to pcap_files" ON public.pcap_files;

CREATE POLICY "Users can view files from own sessions"
  ON public.pcap_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_sessions
      WHERE analysis_sessions.id = pcap_files.session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert files to own sessions"
  ON public.pcap_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_sessions
      WHERE analysis_sessions.id = pcap_files.session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

-- Update RLS for call_metrics
DROP POLICY IF EXISTS "Allow all access to call_metrics" ON public.call_metrics;

CREATE POLICY "Users can view metrics from own sessions"
  ON public.call_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_sessions
      WHERE analysis_sessions.id = call_metrics.session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert call_metrics"
  ON public.call_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Update RLS for interval_metrics
DROP POLICY IF EXISTS "Allow all access to interval_metrics" ON public.interval_metrics;

CREATE POLICY "Users can view interval metrics from own sessions"
  ON public.interval_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.call_metrics
      JOIN public.analysis_sessions ON analysis_sessions.id = call_metrics.session_id
      WHERE call_metrics.id = interval_metrics.call_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert interval_metrics"
  ON public.interval_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Update RLS for sip_messages
DROP POLICY IF EXISTS "Allow all access to sip_messages" ON public.sip_messages;

CREATE POLICY "Users can view SIP messages from own sessions"
  ON public.sip_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_sessions
      WHERE analysis_sessions.id = sip_messages.session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert sip_messages"
  ON public.sip_messages FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add IP lookup cache table for performance
CREATE TABLE public.ip_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  country text,
  city text,
  isp text,
  org text,
  lookup_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view IP lookups"
  ON public.ip_lookups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert IP lookups"
  ON public.ip_lookups FOR INSERT
  TO service_role
  WITH CHECK (true);