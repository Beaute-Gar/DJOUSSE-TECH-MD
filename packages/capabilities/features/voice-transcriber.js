import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
import { getPreferenceVocal } from '../../ainoria-intelligence/core/voice-persona.js';
import { genererVocal } from '../../ainoria-intelligence/core/voice-persona.js';
import { executor, ACTION_TYPES } from '../../ainoria-intelligence/actions/action-executor.js';

const log = createLogger('VTRANSCRIBE');

let enabled = false;
let listener = null;
const tempDir = './temp/voice';

export async function enableTranscriber(sock, apiKey) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      if (msg.message?.audioMessage || msg.message?.pttMessage) {
        transcribeAndReply(sock, msg, apiKey);
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Transcription vocale activée');
}

export function disableTranscriber(sock) { 
  enabled = false; 
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} 
}
export function isTranscriberOn() { return enabled; }

async function transcribeAndReply(sock, msg, apiKey) {
  try {
    const jid = msg.key?.remoteJid;
    const sender = msg.key?.participant || jid;
    const buf = await sock.downloadMediaMessage(msg);
    if (!buf?.length) return;
    
    const tmpFile = path.join(tempDir, `${Date.now()}.ogg`);
    await fs.writeFile(tmpFile, buf);
    
    let text = null;
    if (apiKey) {
      try {
        const form = new FormData();
        const blob = new Blob([buf], { type: 'audio/ogg' });
        form.append('file', blob, 'audio.ogg');
        form.append('model', 'whisper-large-v3-turbo');
        form.append('language', 'fr');
        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { 
          method: 'POST', 
          headers: { 'Authorization': `Bearer ${apiKey}` }, 
          body: form 
        });
        const data = await res.json();
        text = data.text;
      } catch (e) {
        log.warn(`Erreur transcription: ${e.message}`);
      }
    }
    
    await fs.unlink(tmpFile).catch(() => {});
    
    if (text) {
      // Send transcription
      await sock.sendMessage(jid, { 
        text: `🎙️ *Transcription*\n👤 @${(sender||'').split('@')[0]}\n\n"${text}"`, 
        mentions: [sender] 
      });

      // Check if we should reply with voice
      const shouldVoice = await getPreferenceVocal(jid);
      if (shouldVoice) {
        // Generate a response based on the transcribed text
        // This would typically go through your AI pipeline
        // For now, we'll send a voice acknowledgment
        try {
          const voiceBuf = await genererVocal(`J'ai bien entendu: ${text}. Je traite votre message.`, 'femme');
          if (voiceBuf && voiceBuf.length > 100) {
            await executor.execute({
              type: 'send_audio',
              payload: { jid, buffer: voiceBuf, mimetype: 'audio/ogg', ptt: true },
              source: 'voice-transcriber'
            });
          }
        } catch (e) {
          log.warn(`Réponse vocale échouée: ${e.message}`);
        }
      }
    }
  } catch (e) {
    log.error(`Erreur transcriber: ${e.message}`);
  }
}