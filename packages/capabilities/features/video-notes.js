import { createLogger } from '../../infrastructure/logger.js';
import fs from 'fs/promises';
import path from 'path';
const log = createLogger('VIDEONOTES');
let enabled = false, listener = null;
const tempDir = './temp/video-notes';

export async function enableVideoNotes(sock) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      if (!msg.message?.videoMessage) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;
      const duration = msg.message.videoMessage.seconds || 0;
      const sender = msg.key.participant || jid;
      log.info(`Note vidéo reçue de ${sender} (${duration}s)`);
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Notes vidéo activé');
}

export function disableVideoNotes(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function isVideoNotesOn() { return enabled; }
