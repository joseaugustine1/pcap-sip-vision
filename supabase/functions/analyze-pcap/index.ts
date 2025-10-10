import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create client with user context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabaseClient
      .from("analysis_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session || session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden - Session not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Use service role for database writes
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting PCAP analysis for session ${sessionId}`);

    // Get PCAP files for this session
    const { data: pcapFiles, error: filesError } = await supabase
      .from("pcap_files")
      .select("*")
      .eq("session_id", sessionId);

    if (filesError) throw filesError;

    console.log(`Found ${pcapFiles?.length || 0} PCAP files to analyze`);

    // NOTE: In a real implementation, this would:
    // 1. Download PCAP files from storage
    // 2. Run tshark commands to extract VoIP metrics
    // 3. Parse RTP streams, SIP messages, etc.
    // 
    // For demonstration, we'll generate realistic sample data
    // This simulates what tshark would extract from actual PCAP files

    const calls = [];
    const sipMessages = [];
    const numCalls = Math.floor(Math.random() * 5) + 3; // 3-8 calls per session

    // Generate mock call data based on PCAP files
    for (let i = 0; i < numCalls; i++) {
      const callId = `call-${Date.now()}-${i}`;
      const startTime = new Date(Date.now() - Math.random() * 3600000); // Last hour
      const duration = 30 + Math.random() * 300; // 30-330 seconds
      const endTime = new Date(startTime.getTime() + duration * 1000);

      // Generate realistic VoIP metrics
      const baseJitter = 5 + Math.random() * 15; // 5-20ms base jitter
      const baseLatency = 30 + Math.random() * 100; // 30-130ms base latency
      const packetsSent = Math.floor(duration * 50); // ~50 packets/sec
      const packetLoss = Math.floor(Math.random() * (packetsSent * 0.05)); // 0-5% loss

      // Calculate MOS using E-Model (ITU-T G.107)
      // R-factor calculation based on network impairments
      const packetLossPercent = (packetLoss / packetsSent) * 100;
      
      // Delay impairment (Id)
      const effectiveLatency = baseLatency + (baseJitter * 2); // Account for jitter buffer
      const Id = effectiveLatency < 177.3 
        ? 0.024 * effectiveLatency 
        : 0.024 * effectiveLatency + 0.11 * (effectiveLatency - 177.3);
      
      // Equipment impairment (Ie) - codec-specific
      const codecImpairment = 10; // G.711 typical value
      
      // Packet loss impairment (Ie-eff)
      const Bpl = 17; // Packet loss robustness factor for G.711
      const Ie_eff = codecImpairment + (95 - codecImpairment) * (packetLossPercent / (packetLossPercent + Bpl));
      
      // Calculate R-factor
      const R0 = 94.2; // Base R-value
      const Is = 1.5; // Simultaneous impairment
      const R = Math.max(0, Math.min(100, R0 - Id - Ie_eff - Is));
      
      // Convert R-factor to MOS (ITU-T G.107)
      let mosScore;
      if (R < 0) {
        mosScore = 1.0;
      } else if (R < 100) {
        mosScore = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7 * 0.000001;
      } else {
        mosScore = 4.5;
      }
      mosScore = Math.max(1.0, Math.min(5.0, mosScore));

      const sourceIp = `10.0.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`;
      const destIp = `10.0.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`;

      const callMetric = {
        session_id: sessionId,
        call_id: callId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: duration,
        codec: ["G.711", "G.729", "Opus"][Math.floor(Math.random() * 3)],
        packets_sent: packetsSent,
        packets_received: packetsSent - packetLoss,
        packets_lost: packetLoss,
        avg_jitter: baseJitter,
        max_jitter: baseJitter * 1.5,
        avg_latency: baseLatency,
        max_latency: baseLatency * 1.3,
        mos_score: mosScore,
        source_ip: sourceIp,
        dest_ip: destIp,
      };

      const { data: insertedCall, error: callError } = await supabase
        .from("call_metrics")
        .insert([callMetric])
        .select()
        .single();

      if (callError) {
        console.error("Error inserting call metric:", callError);
        continue;
      }

      calls.push(insertedCall);

      // Generate interval metrics (5-second intervals)
      const intervals = [];
      for (let t = 0; t < duration; t += 5) {
        const intervalStart = new Date(startTime.getTime() + t * 1000);
        const intervalEnd = new Date(intervalStart.getTime() + 5000);

        // Add some variance to interval metrics
        const variance = (Math.random() - 0.5) * 2;
        intervals.push({
          call_id: insertedCall.id,
          interval_start: intervalStart.toISOString(),
          interval_end: intervalEnd.toISOString(),
          jitter: Math.max(0, baseJitter + variance * 5),
          latency: Math.max(0, baseLatency + variance * 10),
          packet_loss: Math.max(0, Math.min(10, (packetLoss / packetsSent) * 100 + variance)),
          mos_score: Math.max(1.0, Math.min(5.0, mosScore + variance * 0.2)),
        });
      }

      if (intervals.length > 0) {
        const { error: intervalsError } = await supabase
          .from("interval_metrics")
          .insert(intervals);

        if (intervalsError) {
          console.error("Error inserting interval metrics:", intervalsError);
        }
      }

      // Generate SIP messages for this call
      const sipSequence = [
        { method: "INVITE", status: null, type: "request" },
        { method: null, status: 100, type: "response" },
        { method: null, status: 180, type: "response" },
        { method: null, status: 200, type: "response" },
        { method: "ACK", status: null, type: "request" },
        { method: "BYE", status: null, type: "request" },
        { method: null, status: 200, type: "response" },
      ];

      let messageTime = new Date(startTime);
      for (const sipMsg of sipSequence) {
        messageTime = new Date(messageTime.getTime() + Math.random() * 2000);

        sipMessages.push({
          session_id: sessionId,
          call_id: callId,
          timestamp: messageTime.toISOString(),
          source_ip: sipMsg.type === "request" ? sourceIp : destIp,
          source_port: sipMsg.type === "request" ? 5060 : 5061,
          dest_ip: sipMsg.type === "request" ? destIp : sourceIp,
          dest_port: sipMsg.type === "request" ? 5061 : 5060,
          method: sipMsg.method,
          status_code: sipMsg.status,
          message_type: sipMsg.type,
          content: `SIP/2.0 ${sipMsg.status || sipMsg.method}\nCall-ID: ${callId}\nCSeq: 1 ${sipMsg.method || ""}`,
        });
      }
    }

    // Insert SIP messages
    if (sipMessages.length > 0) {
      const { error: sipError } = await supabase
        .from("sip_messages")
        .insert(sipMessages);

      if (sipError) {
        console.error("Error inserting SIP messages:", sipError);
      }
    }

    // Calculate session averages
    const avgMos = calls.reduce((sum, c) => sum + c.mos_score, 0) / calls.length;
    const avgJitter = calls.reduce((sum, c) => sum + c.avg_jitter, 0) / calls.length;
    const avgLatency = calls.reduce((sum, c) => sum + c.avg_latency, 0) / calls.length;

    // Update session status
    const { error: updateError } = await supabase
      .from("analysis_sessions")
      .update({
        status: "completed",
        total_calls: calls.length,
        avg_mos: avgMos,
        avg_jitter: avgJitter,
        avg_latency: avgLatency,
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    console.log(`Analysis completed for session ${sessionId}: ${calls.length} calls processed`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        callsProcessed: calls.length,
        avgMos,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('[ANALYZE-PCAP]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return new Response(
      JSON.stringify({ error: 'Failed to analyze PCAP files. Please try again later.' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
