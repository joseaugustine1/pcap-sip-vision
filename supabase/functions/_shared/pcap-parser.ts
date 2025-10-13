// PCAP Parser Module for VoIP Analysis
// Supports: PCAP format parsing, RTP detection, SIP message extraction, G.711 audio decoding

export interface RTPPacket {
  version: number;
  padding: boolean;
  extension: boolean;
  csrcCount: number;
  marker: boolean;
  payloadType: number;
  sequenceNumber: number;
  timestamp: number;
  ssrc: number;
  payload: Uint8Array;
  captureTime: number; // microseconds
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
}

export interface SIPMessage {
  timestamp: Date;
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
  method?: string;
  statusCode?: number;
  callId: string;
  content: string;
  sdpBody?: string;
}

export interface CallMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  avgJitter: number;
  maxJitter: number;
  avgLatency: number;
  maxLatency: number;
  mosScore: number;
  codec: string;
}

export function parseRTPPacket(
  udpPayload: Uint8Array,
  captureTime: number,
  sourceIp: string,
  sourcePort: number,
  destIp: string,
  destPort: number
): RTPPacket | null {
  if (udpPayload.length < 12) return null;
  
  const version = (udpPayload[0] >> 6) & 0x03;
  if (version !== 2) return null;
  
  const padding = (udpPayload[0] & 0x20) !== 0;
  const extension = (udpPayload[0] & 0x10) !== 0;
  const csrcCount = udpPayload[0] & 0x0F;
  const marker = (udpPayload[1] & 0x80) !== 0;
  const payloadType = udpPayload[1] & 0x7F;
  
  const sequenceNumber = (udpPayload[2] << 8) | udpPayload[3];
  const timestamp = (udpPayload[4] << 24) | (udpPayload[5] << 16) | 
                    (udpPayload[6] << 8) | udpPayload[7];
  const ssrc = (udpPayload[8] << 24) | (udpPayload[9] << 16) | 
               (udpPayload[10] << 8) | udpPayload[11];
  
  const headerLength = 12 + (csrcCount * 4);
  const payload = udpPayload.slice(headerLength);
  
  return {
    version, padding, extension, csrcCount, marker,
    payloadType, sequenceNumber, timestamp, ssrc,
    payload, captureTime, sourceIp, sourcePort, destIp, destPort
  };
}

export function parseSIPMessage(
  udpPayload: Uint8Array,
  sourceIp: string,
  sourcePort: number,
  destIp: string,
  destPort: number,
  timestamp: Date
): SIPMessage | null {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(udpPayload);
  
  if (!text.startsWith('SIP/2.0') && !text.includes('SIP/2.0')) {
    return null;
  }
  
  const callIdMatch = text.match(/Call-ID:\s*(.+?)(?:\r?\n|$)/i);
  const callId = callIdMatch ? callIdMatch[1].trim() : 'unknown';
  
  let method: string | undefined;
  let statusCode: number | undefined;
  
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine.startsWith('SIP/2.0')) {
    const methodMatch = firstLine.match(/^([A-Z]+)\s/);
    method = methodMatch ? methodMatch[1] : undefined;
  } else {
    const statusMatch = firstLine.match(/^SIP\/2\.0\s+(\d+)/);
    statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;
  }
  
  const blankLineIndex = text.indexOf('\r\n\r\n') !== -1 ? text.indexOf('\r\n\r\n') : text.indexOf('\n\n');
  let sdpBody: string | undefined;
  if (blankLineIndex !== -1) {
    const body = text.slice(blankLineIndex).trim();
    if (body.startsWith('v=0')) {
      sdpBody = body;
    }
  }
  
  return {
    timestamp, sourceIp, sourcePort, destIp, destPort,
    method, statusCode, callId, content: text, sdpBody
  };
}

export function extractCodecFromSDP(sdpBody: string): string {
  const mAudioMatch = sdpBody.match(/m=audio\s+\d+\s+RTP\/AVP\s+([\d\s]+)/);
  if (!mAudioMatch) return 'Unknown';
  
  const payloadTypes = mAudioMatch[1].split(/\s+/).map(Number);
  
  for (const pt of payloadTypes) {
    const rtpmapRegex = new RegExp(`a=rtpmap:${pt}\\s+([^/\\s]+)`);
    const rtpmapMatch = sdpBody.match(rtpmapRegex);
    
    if (rtpmapMatch) {
      const codec = rtpmapMatch[1].toUpperCase();
      if (codec === 'PCMU') return 'G.711 μ-law';
      if (codec === 'PCMA') return 'G.711 A-law';
      if (codec.includes('G729')) return 'G.729';
      if (codec.includes('OPUS')) return 'Opus';
      return codec;
    }
  }
  
  if (payloadTypes.includes(0)) return 'G.711 μ-law';
  if (payloadTypes.includes(8)) return 'G.711 A-law';
  if (payloadTypes.includes(18)) return 'G.729';
  
  return 'Unknown';
}

export function calculateMetrics(rtpPackets: RTPPacket[]): CallMetrics {
  if (rtpPackets.length === 0) {
    throw new Error('No RTP packets to analyze');
  }
  
  const sortedPackets = [...rtpPackets].sort((a, b) => {
    const diff = a.sequenceNumber - b.sequenceNumber;
    return (diff + 32768) % 65536 - 32768;
  });
  
  let packetsLost = 0;
  for (let i = 1; i < sortedPackets.length; i++) {
    const expectedSeq = (sortedPackets[i - 1].sequenceNumber + 1) & 0xFFFF;
    const actualSeq = sortedPackets[i].sequenceNumber;
    if (actualSeq !== expectedSeq) {
      const gap = (actualSeq - expectedSeq + 65536) % 65536;
      packetsLost += gap;
    }
  }
  
  const jitterValues: number[] = [];
  let lastTransit = 0;
  
  for (const packet of sortedPackets) {
    const transit = packet.captureTime - packet.timestamp;
    if (lastTransit !== 0) {
      const d = Math.abs(transit - lastTransit);
      jitterValues.push(d / 1000);
    }
    lastTransit = transit;
  }
  
  const avgJitter = jitterValues.length > 0 
    ? jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length 
    : 0;
  const maxJitter = jitterValues.length > 0 ? Math.max(...jitterValues) : 0;
  
  const avgLatency = avgJitter * 4;
  const maxLatency = maxJitter * 4;
  
  const totalPackets = sortedPackets.length + packetsLost;
  const packetLossPercent = (packetsLost / totalPackets) * 100;
  
  const effectiveLatency = avgLatency + (avgJitter * 2);
  
  const Id = effectiveLatency < 177.3 
    ? 0.024 * effectiveLatency 
    : 0.024 * effectiveLatency + 0.11 * (effectiveLatency - 177.3);
  
  const codecImpairment = 10;
  const Bpl = 17;
  const Ie_eff = codecImpairment + (95 - codecImpairment) * (packetLossPercent / (packetLossPercent + Bpl));
  
  const R0 = 94.2;
  const Is = 1.5;
  const R = Math.max(0, Math.min(100, R0 - Id - Ie_eff - Is));
  
  let mosScore = 1.0;
  if (R >= 0 && R < 100) {
    mosScore = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7 * 0.000001;
  } else if (R >= 100) {
    mosScore = 4.5;
  }
  mosScore = Math.max(1.0, Math.min(5.0, mosScore));
  
  return {
    startTime: new Date(sortedPackets[0].captureTime / 1000),
    endTime: new Date(sortedPackets[sortedPackets.length - 1].captureTime / 1000),
    duration: (sortedPackets[sortedPackets.length - 1].captureTime - sortedPackets[0].captureTime) / 1000000,
    packetsSent: totalPackets,
    packetsReceived: sortedPackets.length,
    packetsLost,
    avgJitter,
    maxJitter,
    avgLatency,
    maxLatency,
    mosScore,
    codec: 'G.711'
  };
}

export function mulawToPcm(mulawByte: number): number {
  const BIAS = 0x84;
  const SIGN_BIT = 0x80;
  const QUANT_MASK = 0x0F;
  const SEG_MASK = 0x70;
  const SEG_SHIFT = 4;
  
  mulawByte = ~mulawByte;
  const sign = (mulawByte & SIGN_BIT);
  const exponent = (mulawByte & SEG_MASK) >> SEG_SHIFT;
  const mantissa = mulawByte & QUANT_MASK;
  
  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  
  return sign ? -sample : sample;
}

export function decodeG711Mulaw(rtpPackets: RTPPacket[]): Int16Array {
  const totalSamples = rtpPackets.reduce((sum, p) => sum + p.payload.length, 0);
  const pcmData = new Int16Array(totalSamples);
  
  let offset = 0;
  for (const packet of rtpPackets) {
    for (let i = 0; i < packet.payload.length; i++) {
      pcmData[offset++] = mulawToPcm(packet.payload[i]);
    }
  }
  
  return pcmData;
}

export function createWavFile(pcmData: Int16Array, sampleRate: number = 8000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * 2;
  const fileSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, fileSize - 8, true);
  view.setUint32(8, 0x57415645, false);
  
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataSize, true);
  
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }
  
  return new Uint8Array(buffer);
}

export async function parsePcapFile(pcapBytes: Uint8Array): Promise<{
  rtpPackets: RTPPacket[];
  sipMessages: SIPMessage[];
}> {
  const rtpPackets: RTPPacket[] = [];
  const sipMessages: SIPMessage[] = [];
  
  const magicNumber = new DataView(pcapBytes.buffer).getUint32(0, false);
  
  let littleEndian = false;
  if (magicNumber === 0xa1b2c3d4) {
    littleEndian = false;
  } else if (magicNumber === 0xd4c3b2a1) {
    littleEndian = true;
  } else {
    throw new Error(`Unsupported PCAP format. Magic number: 0x${magicNumber.toString(16)}`);
  }
  
  let offset = 24;
  
  while (offset + 16 <= pcapBytes.length) {
    const view = new DataView(pcapBytes.buffer, offset);
    
    const ts_sec = view.getUint32(0, littleEndian);
    const ts_usec = view.getUint32(4, littleEndian);
    const incl_len = view.getUint32(8, littleEndian);
    
    offset += 16;
    
    if (offset + incl_len > pcapBytes.length) break;
    
    const packetData = new Uint8Array(pcapBytes.buffer, offset, incl_len);
    const captureTime = (ts_sec * 1000000) + ts_usec;
    const timestamp = new Date(ts_sec * 1000 + Math.floor(ts_usec / 1000));
    
    if (incl_len < 14) {
      offset += incl_len;
      continue;
    }
    
    const etherType = (packetData[12] << 8) | packetData[13];
    
    if (etherType === 0x0800 && incl_len >= 34) {
      const ipPacket = packetData.slice(14);
      const ipVersion = (ipPacket[0] >> 4) & 0x0F;
      const ipHeaderLen = (ipPacket[0] & 0x0F) * 4;
      const protocol = ipPacket[9];
      
      if (ipVersion !== 4 || ipHeaderLen < 20) {
        offset += incl_len;
        continue;
      }
      
      const sourceIp = `${ipPacket[12]}.${ipPacket[13]}.${ipPacket[14]}.${ipPacket[15]}`;
      const destIp = `${ipPacket[16]}.${ipPacket[17]}.${ipPacket[18]}.${ipPacket[19]}`;
      
      if (protocol === 17 && ipPacket.length >= ipHeaderLen + 8) {
        const udpPacket = ipPacket.slice(ipHeaderLen);
        const sourcePort = (udpPacket[0] << 8) | udpPacket[1];
        const destPort = (udpPacket[2] << 8) | udpPacket[3];
        const udpPayload = udpPacket.slice(8);
        
        const rtpPacket = parseRTPPacket(udpPayload, captureTime, sourceIp, sourcePort, destIp, destPort);
        if (rtpPacket) {
          rtpPackets.push(rtpPacket);
        } else {
          const sipMessage = parseSIPMessage(udpPayload, sourceIp, sourcePort, destIp, destPort, timestamp);
          if (sipMessage) {
            sipMessages.push(sipMessage);
          }
        }
      }
    }
    
    offset += incl_len;
  }
  
  return { rtpPackets, sipMessages };
}
