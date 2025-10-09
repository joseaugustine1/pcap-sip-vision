export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_sessions: {
        Row: {
          avg_jitter: number | null
          avg_latency: number | null
          avg_mos: number | null
          created_at: string
          id: string
          name: string
          status: string
          total_calls: number | null
        }
        Insert: {
          avg_jitter?: number | null
          avg_latency?: number | null
          avg_mos?: number | null
          created_at?: string
          id?: string
          name: string
          status?: string
          total_calls?: number | null
        }
        Update: {
          avg_jitter?: number | null
          avg_latency?: number | null
          avg_mos?: number | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          total_calls?: number | null
        }
        Relationships: []
      }
      call_metrics: {
        Row: {
          avg_jitter: number | null
          avg_latency: number | null
          call_id: string
          codec: string | null
          created_at: string
          dest_ip: string | null
          duration: number | null
          end_time: string | null
          id: string
          max_jitter: number | null
          max_latency: number | null
          mos_score: number | null
          packets_lost: number | null
          packets_received: number | null
          packets_sent: number | null
          session_id: string
          source_ip: string | null
          start_time: string | null
        }
        Insert: {
          avg_jitter?: number | null
          avg_latency?: number | null
          call_id: string
          codec?: string | null
          created_at?: string
          dest_ip?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          max_jitter?: number | null
          max_latency?: number | null
          mos_score?: number | null
          packets_lost?: number | null
          packets_received?: number | null
          packets_sent?: number | null
          session_id: string
          source_ip?: string | null
          start_time?: string | null
        }
        Update: {
          avg_jitter?: number | null
          avg_latency?: number | null
          call_id?: string
          codec?: string | null
          created_at?: string
          dest_ip?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          max_jitter?: number | null
          max_latency?: number | null
          mos_score?: number | null
          packets_lost?: number | null
          packets_received?: number | null
          packets_sent?: number | null
          session_id?: string
          source_ip?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interval_metrics: {
        Row: {
          call_id: string
          created_at: string
          id: string
          interval_end: string
          interval_start: string
          jitter: number | null
          latency: number | null
          mos_score: number | null
          packet_loss: number | null
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          interval_end: string
          interval_start: string
          jitter?: number | null
          latency?: number | null
          mos_score?: number | null
          packet_loss?: number | null
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          interval_end?: string
          interval_start?: string
          jitter?: number | null
          latency?: number | null
          mos_score?: number | null
          packet_loss?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interval_metrics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      pcap_files: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          id: string
          session_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size: number
          id?: string
          session_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          session_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcap_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_messages: {
        Row: {
          call_id: string | null
          content: string | null
          created_at: string
          dest_ip: string
          dest_port: number | null
          id: string
          message_type: string
          method: string | null
          session_id: string
          source_ip: string
          source_port: number | null
          status_code: number | null
          timestamp: string
        }
        Insert: {
          call_id?: string | null
          content?: string | null
          created_at?: string
          dest_ip: string
          dest_port?: number | null
          id?: string
          message_type: string
          method?: string | null
          session_id: string
          source_ip: string
          source_port?: number | null
          status_code?: number | null
          timestamp: string
        }
        Update: {
          call_id?: string | null
          content?: string | null
          created_at?: string
          dest_ip?: string
          dest_port?: number | null
          id?: string
          message_type?: string
          method?: string | null
          session_id?: string
          source_ip?: string
          source_port?: number | null
          status_code?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sip_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
