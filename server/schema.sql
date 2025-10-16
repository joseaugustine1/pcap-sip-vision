-- VoIP Analyzer MySQL Schema
-- Run this script to create the database and tables

CREATE DATABASE IF NOT EXISTS voip_analyzer;
USE voip_analyzer;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analysis sessions table
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_calls INT DEFAULT 0,
  avg_mos DECIMAL(3,2),
  avg_jitter DECIMAL(10,2),
  avg_latency DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PCAP files table
CREATE TABLE IF NOT EXISTS pcap_files (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call metrics table
CREATE TABLE IF NOT EXISTS call_metrics (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  call_id TEXT NOT NULL,
  source_ip TEXT,
  dest_ip TEXT,
  codec TEXT,
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  duration DECIMAL(10,2),
  packets_sent INT,
  packets_received INT,
  packets_lost INT,
  avg_jitter DECIMAL(10,2),
  max_jitter DECIMAL(10,2),
  avg_latency DECIMAL(10,2),
  max_latency DECIMAL(10,2),
  mos_score DECIMAL(3,2),
  audio_extraction_status VARCHAR(50) DEFAULT 'pending',
  audio_extraction_error TEXT,
  outbound_audio_path TEXT,
  inbound_audio_path TEXT,
  audio_extracted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Interval metrics table
CREATE TABLE IF NOT EXISTS interval_metrics (
  id VARCHAR(36) PRIMARY KEY,
  call_id VARCHAR(36) NOT NULL,
  interval_start TIMESTAMP NOT NULL,
  interval_end TIMESTAMP NOT NULL,
  jitter DECIMAL(10,2),
  latency DECIMAL(10,2),
  packet_loss DECIMAL(5,2),
  mos_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (call_id) REFERENCES call_metrics(id) ON DELETE CASCADE,
  INDEX idx_call_id (call_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SIP messages table
CREATE TABLE IF NOT EXISTS sip_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  call_id TEXT,
  message_type TEXT NOT NULL,
  method TEXT,
  status_code INT,
  source_ip TEXT NOT NULL,
  source_port INT,
  dest_ip TEXT NOT NULL,
  dest_port INT,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IP lookups table
CREATE TABLE IF NOT EXISTS ip_lookups (
  id VARCHAR(36) PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  country TEXT,
  city TEXT,
  isp TEXT,
  org TEXT,
  lookup_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_address (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
