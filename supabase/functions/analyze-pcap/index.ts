import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  parsePcapFile,
  calculateMetrics,
  extractCodecFromSDP,
  decodeG711Mulaw,
  createWavFile,
  type RTPPacket,
  type SIPMessage
} from "../_shared/pcap-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('[ANALYZE-PCAP] Request received');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    console.log('[ANALYZE-PCAP] Processing session:', sessionId);
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Use service role for database operations
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

    // Storage for all parsed data
    const allRtpPackets: Map<number, RTPPacket[]> = new Map();
    const allSipMessages: SIPMessage[] = [];

    // Download and parse each PCAP file
    for (const pcapFile of pcapFiles) {
      console.log(`Downloading PCAP: ${pcapFile.file_path}`);
      
      try {
        const { data: pcapData, error: downloadError } = await supabase.storage
          .from('pcap-files')
          .download(pcapFile.file_path);
        
        if (downloadError) {
          console.error(`Failed to download ${pcapFile.file_path}:`, downloadError);
          continue;
        }
        
        const pcapBytes = new Uint8Array(await pcapData.arrayBuffer());
        console.log(`Parsing PCAP file (${pcapBytes.length} bytes)...`);
        
        const { rtpPackets, sipMessages } = await parsePcapFile(pcapBytes);
        
        console.log(`Extracted ${rtpPackets.length} RTP packets, ${sipMessages.length} SIP messages`);
        
        for (const packet of rtpPackets) {
          if (!allRtpPackets.has(packet.ssrc)) {
            allRtpPackets.set(packet.ssrc, []);
          }
          allRtpPackets.get(packet.ssrc)!.push(packet);
        }
        
        allSipMessages.push(...sipMessages);
        
      } catch (parseError) {
        console.error(`Error parsing ${pcapFile.file_path}:`, parseError);
      }
    }

    console.log(`Total: ${allRtpPackets.size} RTP streams, ${allSipMessages.length} SIP messages`);

    // Group data by Call-ID
    const callMap: Map<string, {
      sipMessages: SIPMessage[];
      rtpStreams: Map<number, RTPPacket[]>;
    }> = new Map();

    for (const sipMsg of allSipMessages) {
      if (!callMap.has(sipMsg.callId)) {
        callMap.set(sipMsg.callId, {
          sipMessages: [],
          rtpStreams: new Map()
        });
      }
      callMap.get(sipMsg.callId)!.sipMessages.push(sipMsg);
    }

    // Match RTP streams to calls
    for (const [ssrc, packets] of allRtpPackets) {
      if (packets.length === 0) continue;
      
      const firstPacket = packets[0];
      const packetTime = new Date(firstPacket.captureTime / 1000);
      
      let matchedCallId: string | null = null;
      let minTimeDiff = Infinity;
      
      for (const [callId, callData] of callMap) {
        const invite = callData.sipMessages.find(m => m.method === 'INVITE');
        if (invite) {
          const timeDiff = Math.abs(packetTime.getTime() - invite.timestamp.getTime());
          
          const ipMatch = 
            (invite.sourceIp === firstPacket.sourceIp || invite.destIp === firstPacket.sourceIp) &&
            (invite.sourceIp === firstPacket.destIp || invite.destIp === firstPacket.destIp);
          
          if (ipMatch && timeDiff < 10000 && timeDiff < minTimeDiff) {
            matchedCallId = callId;
            minTimeDiff = timeDiff;
          }
        }
      }
      
      if (matchedCallId) {
        callMap.get(matchedCallId)!.rtpStreams.set(ssrc, packets);
      } else {
        const syntheticCallId = `rtp-${ssrc}`;
        callMap.set(syntheticCallId, {
          sipMessages: [],
          rtpStreams: new Map([[ssrc, packets]])
        });
      }
    }

    console.log(`Organized into ${callMap.size} calls`);

    const insertedCalls = [];
    const intervalMetricsToInsert = [];

    // Process each call
    for (const [callId, callData] of callMap) {
      if (callData.rtpStreams.size === 0) {
        console.log(`Call ${callId}: No RTP data, skipping`);
        continue;
      }
      
      try {
        const inviteWithSdp = callData.sipMessages.find(m => m.method === 'INVITE' && m.sdpBody);
        const codec = inviteWithSdp ? extractCodecFromSDP(inviteWithSdp.sdpBody!) : 'Unknown';
        
        const primaryStreamEntry = Array.from(callData.rtpStreams.entries())
          .sort((a, b) => b[1].length - a[1].length)[0];
        const [primarySsrc, primaryStream] = primaryStreamEntry;
        
        console.log(`Call ${callId}: ${primaryStream.length} RTP packets, codec: ${codec}`);
        
        const metrics = calculateMetrics(primaryStream);
        
        let sourceIp = primaryStream[0].sourceIp;
        let destIp = primaryStream[0].destIp;
        if (callData.sipMessages.length > 0) {
          sourceIp = callData.sipMessages[0].sourceIp;
          destIp = callData.sipMessages[0].destIp;
        }
        
        const { data: insertedCall, error: callError } = await supabase
          .from('call_metrics')
          .insert([{
            session_id: sessionId,
            call_id: callId,
            start_time: metrics.startTime.toISOString(),
            end_time: metrics.endTime.toISOString(),
            duration: metrics.duration,
            codec: codec,
            packets_sent: metrics.packetsSent,
            packets_received: metrics.packetsReceived,
            packets_lost: metrics.packetsLost,
            avg_jitter: metrics.avgJitter,
            max_jitter: metrics.maxJitter,
            avg_latency: metrics.avgLatency,
            max_latency: metrics.maxLatency,
            mos_score: metrics.mosScore,
            source_ip: sourceIp,
            dest_ip: destIp,
            audio_extraction_status: 'pending'
          }])
          .select()
          .single();
        
        if (callError) {
          console.error(`Error inserting call metric for ${callId}:`, callError);
          continue;
        }
        
        insertedCalls.push(insertedCall);
        console.log(`Call ${callId}: Metrics inserted, MOS: ${metrics.mosScore.toFixed(2)}`);
        
        // Generate interval metrics
        const intervalDuration = 5000000;
        const startTime = primaryStream[0].captureTime;
        const endTime = primaryStream[primaryStream.length - 1].captureTime;
        const numIntervals = Math.ceil((endTime - startTime) / intervalDuration);
        
        for (let i = 0; i < numIntervals; i++) {
          const intervalStart = startTime + (i * intervalDuration);
          const intervalEnd = intervalStart + intervalDuration;
          
          const intervalPackets = primaryStream.filter(
            p => p.captureTime >= intervalStart && p.captureTime < intervalEnd
          );
          
          if (intervalPackets.length > 0) {
            const intervalMetrics = calculateMetrics(intervalPackets);
            
            intervalMetricsToInsert.push({
              call_id: insertedCall.id,
              interval_start: new Date(intervalStart / 1000).toISOString(),
              interval_end: new Date(intervalEnd / 1000).toISOString(),
              jitter: intervalMetrics.avgJitter,
              latency: intervalMetrics.avgLatency,
              packet_loss: intervalMetrics.packetsLost,
              mos_score: intervalMetrics.mosScore
            });
          }
        }
        
        // Audio extraction
        if (codec.includes('G.711') || codec.includes('μ-law') || codec.includes('PCMU')) {
          console.log(`Call ${callId}: Starting G.711 audio extraction...`);
          
          try {
            const streams = Array.from(callData.rtpStreams.entries());
            
            for (let idx = 0; idx < Math.min(streams.length, 2); idx++) {
              const [ssrc, packets] = streams[idx];
              const direction = idx === 0 ? 'outbound' : 'inbound';
              
              const pcmData = decodeG711Mulaw(packets);
              const wavData = createWavFile(pcmData, 8000);
              
              const audioPath = `${sessionId}/${insertedCall.id}_${direction}.wav`;
              
              const { error: uploadError } = await supabase.storage
                .from('audio-files')
                .upload(audioPath, wavData, {
                  contentType: 'audio/wav',
                  upsert: true
                });
              
              if (uploadError) {
                console.error(`Failed to upload ${direction} audio:`, uploadError);
                continue;
              }
              
              const updateField = direction === 'outbound' ? 'outbound_audio_path' : 'inbound_audio_path';
              await supabase
                .from('call_metrics')
                .update({
                  [updateField]: audioPath,
                  audio_extraction_status: 'completed',
                  audio_extracted_at: new Date().toISOString()
                })
                .eq('id', insertedCall.id);
              
              console.log(`Call ${callId}: ${direction} audio extracted (${pcmData.length} samples)`);
            }
            
          } catch (audioError) {
            console.error(`Audio extraction error for ${callId}:`, audioError);
            await supabase
              .from('call_metrics')
              .update({
                audio_extraction_status: 'failed',
                audio_extraction_error: String(audioError)
              })
              .eq('id', insertedCall.id);
          }
          
        } else {
          console.log(`Call ${callId}: Codec ${codec} not supported for audio extraction`);
          await supabase
            .from('call_metrics')
            .update({
              audio_extraction_status: 'unsupported',
              audio_extraction_error: `Codec ${codec} not yet supported (only G.711 μ-law currently)`
            })
            .eq('id', insertedCall.id);
        }
        
      } catch (callError) {
        console.error(`Error processing call ${callId}:`, callError);
      }
    }

    // Insert interval metrics
    if (intervalMetricsToInsert.length > 0) {
      const { error: intervalError } = await supabase
        .from('interval_metrics')
        .insert(intervalMetricsToInsert);
      
      if (intervalError) {
        console.error('Error inserting interval metrics:', intervalError);
      } else {
        console.log(`Inserted ${intervalMetricsToInsert.length} interval metrics`);
      }
    }

    // Insert SIP messages
    const sipMessagesToInsert = allSipMessages.map(msg => ({
      session_id: sessionId,
      call_id: msg.callId,
      timestamp: msg.timestamp.toISOString(),
      source_ip: msg.sourceIp,
      source_port: msg.sourcePort,
      dest_ip: msg.destIp,
      dest_port: msg.destPort,
      method: msg.method,
      status_code: msg.statusCode,
      message_type: msg.method ? 'request' : 'response',
      content: msg.content
    }));

    if (sipMessagesToInsert.length > 0) {
      const { error: sipError } = await supabase
        .from('sip_messages')
        .insert(sipMessagesToInsert);
      
      if (sipError) {
        console.error('Error inserting SIP messages:', sipError);
      } else {
        console.log(`Inserted ${sipMessagesToInsert.length} SIP messages`);
      }
    }

    const calls = insertedCalls;

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
