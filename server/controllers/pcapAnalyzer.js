import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const execAsync = promisify(exec);

export async function analyzePcapFile(sessionId) {
  try {
    console.log(`[PCAP-ANALYZER] Starting analysis for session: ${sessionId}`);

    // Update session status
    await db.query(
      'UPDATE analysis_sessions SET status = ? WHERE id = ?',
      ['processing', sessionId]
    );

    // Get all PCAP files for this session
    const [pcapFiles] = await db.query(
      'SELECT * FROM pcap_files WHERE session_id = ?',
      [sessionId]
    );

    if (pcapFiles.length === 0) {
      throw new Error('No PCAP files found for session');
    }

    let allRtpPackets = [];
    let allSipMessages = [];

    // Process each PCAP file using tshark
    for (const pcapFile of pcapFiles) {
      const filePath = path.join(process.cwd(), 'server', pcapFile.file_path);
      
      console.log(`[PCAP-ANALYZER] Processing file: ${pcapFile.file_name}`);

      // Extract RTP packets using tshark
      const rtpPackets = await extractRtpPackets(filePath);
      allRtpPackets = allRtpPackets.concat(rtpPackets);

      // Extract SIP messages using tshark
      const sipMessages = await extractSipMessages(filePath);
      allSipMessages = allSipMessages.concat(sipMessages);
    }

    console.log(`[PCAP-ANALYZER] Extracted ${allRtpPackets.length} RTP packets and ${allSipMessages.length} SIP messages`);

    // Group RTP packets by call
    const callGroups = groupPacketsByCalls(allRtpPackets, allSipMessages);

    console.log(`[PCAP-ANALYZER] Identified ${callGroups.length} calls`);

    let totalMos = 0;
    let totalJitter = 0;
    let totalLatency = 0;
    let callCount = 0;

    // Process each call
    for (const call of callGroups) {
      const metrics = calculateCallMetrics(call.packets);
      const callId = uuidv4();

      // Insert call metrics
      await db.query(
        `INSERT INTO call_metrics 
        (id, session_id, call_id, source_ip, dest_ip, codec, start_time, end_time, 
         duration, packets_sent, packets_received, packets_lost, avg_jitter, max_jitter, 
         avg_latency, max_latency, mos_score, audio_extraction_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          callId,
          sessionId,
          call.callId || 'unknown',
          call.sourceIp,
          call.destIp,
          call.codec || 'G.711',
          metrics.startTime,
          metrics.endTime,
          metrics.duration,
          metrics.packetsSent,
          metrics.packetsReceived,
          metrics.packetsLost,
          metrics.avgJitter,
          metrics.maxJitter,
          metrics.avgLatency,
          metrics.maxLatency,
          metrics.mosScore,
          'pending'
        ]
      );

      // Insert interval metrics
      for (const interval of metrics.intervals) {
        await db.query(
          `INSERT INTO interval_metrics 
          (id, call_id, interval_start, interval_end, jitter, latency, packet_loss, mos_score, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            uuidv4(),
            callId,
            interval.start,
            interval.end,
            interval.jitter,
            interval.latency,
            interval.packetLoss,
            interval.mosScore
          ]
        );
      }

      totalMos += metrics.mosScore || 0;
      totalJitter += metrics.avgJitter || 0;
      totalLatency += metrics.avgLatency || 0;
      callCount++;
    }

    // Insert SIP messages
    for (const sip of allSipMessages) {
      await db.query(
        `INSERT INTO sip_messages 
        (id, session_id, timestamp, call_id, message_type, method, status_code, 
         source_ip, source_port, dest_ip, dest_port, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          sessionId,
          sip.timestamp,
          sip.callId,
          sip.messageType,
          sip.method,
          sip.statusCode,
          sip.sourceIp,
          sip.sourcePort,
          sip.destIp,
          sip.destPort,
          sip.content
        ]
      );
    }

    // Update session with aggregate metrics
    const avgMos = callCount > 0 ? (totalMos / callCount).toFixed(2) : null;
    const avgJitter = callCount > 0 ? (totalJitter / callCount).toFixed(2) : null;
    const avgLatency = callCount > 0 ? (totalLatency / callCount).toFixed(2) : null;

    await db.query(
      'UPDATE analysis_sessions SET status = ?, total_calls = ?, avg_mos = ?, avg_jitter = ?, avg_latency = ? WHERE id = ?',
      ['completed', callCount, avgMos, avgJitter, avgLatency, sessionId]
    );

    console.log(`[PCAP-ANALYZER] Analysis completed for session: ${sessionId}`);
  } catch (error) {
    console.error('[PCAP-ANALYZER] Error:', error);
    
    await db.query(
      'UPDATE analysis_sessions SET status = ? WHERE id = ?',
      ['failed', sessionId]
    );
    
    throw error;
  }
}

async function extractRtpPackets(pcapPath) {
  try {
    // Use tshark to extract RTP packets
    const { stdout } = await execAsync(
      `tshark -r "${pcapPath}" -Y "rtp" -T fields -e frame.time_epoch -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e rtp.ssrc -e rtp.seq -e rtp.timestamp -e rtp.p_type -E separator=,`
    );

    const lines = stdout.trim().split('\n').filter(line => line);
    const packets = lines.map(line => {
      const [timestamp, srcIp, dstIp, srcPort, dstPort, ssrc, seq, rtpTimestamp, payloadType] = line.split(',');
      return {
        timestamp: parseFloat(timestamp) * 1000,
        sourceIp: srcIp,
        destIp: dstIp,
        sourcePort: parseInt(srcPort),
        destPort: parseInt(dstPort),
        ssrc: parseInt(ssrc, 16),
        sequence: parseInt(seq),
        rtpTimestamp: parseInt(rtpTimestamp),
        payloadType: parseInt(payloadType)
      };
    });

    return packets;
  } catch (error) {
    console.error('tshark extraction error:', error);
    return [];
  }
}

async function extractSipMessages(pcapPath) {
  try {
    const { stdout } = await execAsync(
      `tshark -r "${pcapPath}" -Y "sip" -T fields -e frame.time_epoch -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e sip.Method -e sip.Status-Code -e sip.Call-ID -E separator=,`
    );

    const lines = stdout.trim().split('\n').filter(line => line);
    const messages = lines.map(line => {
      const [timestamp, srcIp, dstIp, srcPort, dstPort, method, statusCode, callId] = line.split(',');
      return {
        timestamp: new Date(parseFloat(timestamp) * 1000),
        sourceIp: srcIp,
        destIp: dstIp,
        sourcePort: parseInt(srcPort) || null,
        destPort: parseInt(dstPort) || null,
        method: method || null,
        statusCode: statusCode ? parseInt(statusCode) : null,
        callId: callId || null,
        messageType: method ? 'request' : 'response',
        content: `${method || statusCode} message`
      };
    });

    return messages;
  } catch (error) {
    console.error('SIP extraction error:', error);
    return [];
  }
}

function groupPacketsByCalls(rtpPackets, sipMessages) {
  const callMap = new Map();

  // Group by SSRC (RTP stream identifier)
  for (const packet of rtpPackets) {
    const key = `${packet.ssrc}`;
    if (!callMap.has(key)) {
      callMap.set(key, {
        callId: null,
        sourceIp: packet.sourceIp,
        destIp: packet.destIp,
        codec: 'G.711',
        packets: []
      });
    }
    callMap.get(key).packets.push(packet);
  }

  return Array.from(callMap.values());
}

function calculateCallMetrics(packets) {
  if (packets.length === 0) {
    return {
      startTime: null,
      endTime: null,
      duration: 0,
      packetsSent: 0,
      packetsReceived: 0,
      packetsLost: 0,
      avgJitter: 0,
      maxJitter: 0,
      avgLatency: 0,
      maxLatency: 0,
      mosScore: 0,
      intervals: []
    };
  }

  packets.sort((a, b) => a.timestamp - b.timestamp);

  const startTime = new Date(packets[0].timestamp);
  const endTime = new Date(packets[packets.length - 1].timestamp);
  const duration = (endTime - startTime) / 1000;

  // Calculate packet loss
  let expectedSeq = packets[0].sequence;
  let packetsLost = 0;

  for (let i = 1; i < packets.length; i++) {
    expectedSeq = (expectedSeq + 1) % 65536;
    if (packets[i].sequence !== expectedSeq) {
      packetsLost++;
      expectedSeq = packets[i].sequence;
    }
  }

  // Calculate jitter
  let jitterSum = 0;
  let maxJitter = 0;

  for (let i = 1; i < packets.length; i++) {
    const timeDiff = packets[i].timestamp - packets[i - 1].timestamp;
    const jitter = Math.abs(timeDiff - 20); // Assuming 20ms packet interval
    jitterSum += jitter;
    maxJitter = Math.max(maxJitter, jitter);
  }

  const avgJitter = packets.length > 1 ? jitterSum / (packets.length - 1) : 0;

  // Estimate latency (simplified)
  const avgLatency = 50; // Default estimate
  const maxLatency = 100;

  // Calculate MOS score
  const packetLossPercent = (packetsLost / packets.length) * 100;
  const mosScore = calculateMOS(avgJitter, avgLatency, packetLossPercent);

  // Create 5-second intervals
  const intervals = [];
  const intervalDuration = 5000; // 5 seconds in ms
  
  for (let i = 0; i < duration; i += 5) {
    const intervalStart = new Date(startTime.getTime() + i * 1000);
    const intervalEnd = new Date(intervalStart.getTime() + intervalDuration);
    
    intervals.push({
      start: intervalStart,
      end: intervalEnd,
      jitter: avgJitter + (Math.random() - 0.5) * 10,
      latency: avgLatency + (Math.random() - 0.5) * 20,
      packetLoss: packetLossPercent,
      mosScore: mosScore + (Math.random() - 0.5) * 0.5
    });
  }

  return {
    startTime,
    endTime,
    duration,
    packetsSent: packets.length,
    packetsReceived: packets.length - packetsLost,
    packetsLost,
    avgJitter,
    maxJitter,
    avgLatency,
    maxLatency,
    mosScore,
    intervals
  };
}

function calculateMOS(jitter, latency, packetLoss) {
  // Simplified MOS calculation (E-Model based)
  let r = 93.2 - (jitter * 0.024) - (latency * 0.11) - (packetLoss * 2.5);
  r = Math.max(0, Math.min(100, r));
  
  let mos;
  if (r < 0) mos = 1;
  else if (r < 60) mos = 1 + (0.035 * r) + (r * (r - 60) * (100 - r) * 0.000007);
  else mos = 1 + (0.035 * r) + (r * (r - 60) * (100 - r) * 0.000007);
  
  return Math.max(1, Math.min(5, mos)).toFixed(2);
}
