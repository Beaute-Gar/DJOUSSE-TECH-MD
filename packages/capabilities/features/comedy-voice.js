import { createLogger } from '../../infrastructure/logger.js';
import { generateComedyVoiceText, getComedyMusic, getMusicCategory, getConvContext } from './smart-context.js';
import { isFlirtActive, getFlirtTarget } from './dynamic-persona.js';

const log = createLogger('COMEDYVOICE');

let enabled = false;
let lastVoiceTimestamps = new Map();
const MIN_INTERVAL_MS = 120000;

export async function enableComedyVoice(sock) {
  if (enabled) return;
  enabled = true;

  sock.ev.on('messages.upsert', async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const jid = msg.key.remoteJid;
      const sender = msg.pushName || msg.key.participant || 'inconnu';
      if (!jid?.endsWith('@g.us')) continue;

      const flirtActive = isFlirtActive(jid);
      const flirtTarget = getFlirtTarget(jid);

      if (flirtActive && flirtTarget) {
        const senderLower = sender.toLowerCase();
        const targetLower = flirtTarget.toLowerCase();
        const textLower = text.toLowerCase();
        if (!senderLower.includes(targetLower) && senderLower !== targetLower) {
          if (Math.random() > 0.4) continue;
          const now = Date.now();
          const last = lastVoiceTimestamps.get(jid) || 0;
          if (now - last < MIN_INTERVAL_MS) continue;
          const ctx = getConvContext(jid);
          const isGirlTarget = !textLower.includes('mec') && !textLower.includes('gars') && !textLower.includes('frère');
          const category = isGirlTarget ? 'romantic' : 'funny';
          try {
            const voiceText = await generateComedyVoiceText(`flirt avec ${flirtTarget}`, sender);
            const musicUrl = await getComedyMusic(category);
            await sendComedyVoice(sock, jid, voiceText, musicUrl);
            lastVoiceTimestamps.set(jid, now);
          } catch (e) { log.warn(`Flirt voice error: ${e.message}`); }
          continue;
        }
      }

      if (!/(?:mdr|ptdr|haha|lol|😂|🤣|😭|💀|wesh|trop\s+fort|jure|sah|bg|boloss|vasi|vas-y)/i.test(text)) continue;
      if (Math.random() > 0.25) continue;
      const now = Date.now();
      const last = lastVoiceTimestamps.get(jid) || 0;
      if (now - last < MIN_INTERVAL_MS) continue;
      try {
        const voiceText = await generateComedyVoiceText('Situation drôle groupe WhatsApp');
        const musicUrl = await getComedyMusic('funny');
        await sendComedyVoice(sock, jid, voiceText, musicUrl);
        lastVoiceTimestamps.set(jid, now);
      } catch (e) { log.warn(`Comedy voice: ${e.message}`); }
    }
  });

  log.info('Comedy Voice activée');
}

async function sendComedyVoice(sock, jid, voiceText, musicUrl) {
  try {
    if (process.env.ELEVENLABS_API_KEY) {
      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: voiceText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.3, similarity_boost: 0.5, style: 0.5 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        await sock.sendMessage(jid, { audio: Buffer.from(await res.arrayBuffer()), mimetype: 'audio/mp4', ptt: true });
        return;
      }
      log.warn(`ElevenLabs: ${res.status}, fallback text`);
    }
    await sock.sendMessage(jid, { text: `🎙️ *${voiceText}* ${musicUrl ? `\n[🎵 Musique de fond]` : ''}` });
  } catch (e) {
    log.warn(`Voice send: ${e.message}`);
    await sock.sendMessage(jid, { text: `😆 *${voiceText}*` });
  }
}

export function disableComedyVoice(sock) { enabled = false; }
export function isComedyVoiceOn() { return enabled; }
