import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('VTRANSLATE');

let enabled = false, listener = null;
const tempDir = './temp/voice_translate';

export async function enableVoiceTranslator(sock, apiKey) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      if (!(msg.message?.audioMessage || msg.message?.pttMessage)) continue;
      const jid = msg.key.remoteJid; if (!jid) continue;
      const sender = msg.key.participant || jid;
      try {
        const buf = await sock.downloadMediaMessage(msg);
        if (!buf?.length) return;
        const tmpFile = path.join(tempDir, `${Date.now()}.ogg`);
        await fs.writeFile(tmpFile, buf);
        let text = null;
        if (apiKey) {
          const form = new FormData(); form.append('file', new Blob([buf], { type: 'audio/ogg' }), 'audio.ogg');
          form.append('model', 'whisper-large-v3-turbo');
          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: form });
          text = (await res.json()).text;
        }
        await fs.unlink(tmpFile).catch(() => {});
        if (!text) return;
        const hasNonAscii = /[^\x00-\x7F]/.test(text);
        const prompt = hasNonAscii ? `Traduis ce texte en français: "${text}"` : `Translate to French: "${text}"`;
        const tRes = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], max_tokens: 500 }) });
        const translated = (await tRes.json()).choices?.[0]?.message?.content || text;
        await sock.sendMessage(jid, { text: `🌍 *Voix traduite*\n🎙️ @${sender.split('@')[0]}\n\n📝 "${text}"\n\n🇫🇷 "${translated}"`, mentions: [sender] });
      } catch (e) { log.warn(`Voice translate error: ${e.message}`); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Traducteur vocal activé');
}

export function disableVoiceTranslator(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isVoiceTranslatorOn() { return enabled; }
