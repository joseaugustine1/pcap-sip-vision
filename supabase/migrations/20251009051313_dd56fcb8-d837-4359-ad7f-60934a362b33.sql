-- Create analysis_sessions table to track PCAP uploads and analysis
CREATE TABLE public.analysis_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  total_calls INTEGER DEFAULT 0,
  avg_mos DECIMAL(3, 2),
  avg_jitter DECIMAL(10, 2),
  avg_latency DECIMAL(10, 2)
);

-- Create pcap_files table to store uploaded PCAP file references
CREATE TABLE public.pcap_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_metrics table for detailed per-call metrics
CREATE TABLE public.call_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration DECIMAL(10, 2),
  codec TEXT,
  packets_sent INTEGER,
  packets_received INTEGER,
  packets_lost INTEGER,
  avg_jitter DECIMAL(10, 2),
  max_jitter DECIMAL(10, 2),
  avg_latency DECIMAL(10, 2),
  max_latency DECIMAL(10, 2),
  mos_score DECIMAL(3, 2),
  source_ip TEXT,
  dest_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interval_metrics table for time-series analysis
CREATE TABLE public.interval_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.call_metrics(id) ON DELETE CASCADE,
  interval_start TIMESTAMP WITH TIME ZONE NOT NULL,
  interval_end TIMESTAMP WITH TIME ZONE NOT NULL,
  jitter DECIMAL(10, 2),
  latency DECIMAL(10, 2),
  packet_loss DECIMAL(5, 2),
  mos_score DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sip_messages table for SIP ladder diagram
CREATE TABLE public.sip_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  call_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  source_ip TEXT NOT NULL,
  source_port INTEGER,
  dest_ip TEXT NOT NULL,
  dest_port INTEGER,
  method TEXT,
  status_code INTEGER,
  message_type TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcap_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interval_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this tool)
CREATE POLICY "Allow all access to analysis_sessions" 
ON public.analysis_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to pcap_files" 
ON public.pcap_files FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to call_metrics" 
ON public.call_metrics FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to interval_metrics" 
ON public.interval_metrics FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to sip_messages" 
ON public.sip_messages FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for PCAP files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pcap-files', 'pcap-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow all uploads to pcap-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pcap-files');

CREATE POLICY "Allow all downloads from pcap-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'pcap-files');

-- Create indexes for better query performance
CREATE INDEX idx_pcap_files_session ON public.pcap_files(session_id);
CREATE INDEX idx_call_metrics_session ON public.call_metrics(session_id);
CREATE INDEX idx_interval_metrics_call ON public.interval_metrics(call_id);
CREATE INDEX idx_sip_messages_session ON public.sip_messages(session_id);
CREATE INDEX idx_sip_messages_timestamp ON public.sip_messages(timestamp);