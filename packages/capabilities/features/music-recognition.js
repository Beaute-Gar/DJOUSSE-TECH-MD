import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('MUSTREC');

let enabled = false;
let listener = null;
const tempDir = './temp/audio';

export async function enableMusicRecognition(sock) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      if (msg.message?.audioMessage || msg.message?.pttMessage) {
        transcribeAudio(sock, msg);
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Reconnaissance musicale activée');
}

async function transcribeAudio(sock, msg) {
  const apiKey = config.GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return;
  try {
    const jid = msg.key.remoteJid;
    const buf = await sock.downloadMediaMessage(msg);
    if (!buf?.length) return;
    const tmpFile = path.join(tempDir, Date.now() + '.ogg');
    await fs.writeFile(tmpFile, buf);
    const form = new FormData();
    const blob = new Blob([buf], { type: 'audio/ogg' });
    form.append('file', blob, 'audio.ogg');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'fr');
    form.append('response_format', 'json');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: form,
    });
    const data = await res.json();
    await fs.unlink(tmpFile).catch(() => {});
    if (data.text) {
      await sock.sendMessage(jid, {
        text: '?? *Transcription audio*\n\n"' + data.text + '"',
      }, { quoted: msg });
    }
  } catch (e) {
    log.warn('Erreur transcription audio: ' + e.message);
  }
}

export function disableMusicRecognition(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
export function isMusicRecognitionOn() { return enabled; }
