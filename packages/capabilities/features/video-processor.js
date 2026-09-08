import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
import ffmpeg from 'fluent-ffmpeg';
const log = createLogger('VIDPROC');

let enabled = false, listener = null;
const tempDir = './temp/video';

export async function enableVideoProcessor(sock) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const vid = msg.message?.videoMessage;
      if (!vid) continue;
      const jid = msg.key.remoteJid; if (!jid) continue;
      try {
        const buf = await sock.downloadMediaMessage(msg);
        if (!buf?.length) return;
        const tmpFile = path.join(tempDir, `${Date.now()}.mp4`);
        const thumbFile = path.join(tempDir, `${Date.now()}_thumb.jpg`);
        await fs.writeFile(tmpFile, buf);
        await new Promise((resolve, reject) => {
          ffmpeg(tmpFile).screenshots({ timestamps: ['50%'], filename: path.basename(thumbFile), folder: tempDir, size: '320x?' }).on('end', resolve).on('error', reject);
        }).catch(() => {});
        const thumbExists = await fs.access(thumbFile).then(() => true).catch(() => false);
        const info = { duration: vid.seconds || 0, size: vid.fileLength || buf.length, mime: vid.mimetype || 'video/mp4' };
        let msgText = `🎬 *Vidéo reçue*\n⏱️ ${Math.floor(info.duration / 60)}:${String(Math.floor(info.duration % 60)).padStart(2, '0')}\n📏 ${(info.size / 1024 / 1024).toFixed(1)}MB`;
        if (thumbExists) {
          const thumbBuf = await fs.readFile(thumbFile);
          await sock.sendMessage(jid, { image: thumbBuf, caption: msgText });
          await fs.unlink(thumbFile).catch(() => {});
        } else { sock.sendMessage(jid, { text: msgText }); }
        await fs.unlink(tmpFile).catch(() => {});
      } catch (e) { log.warn(`Video proc error: ${e.message}`); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Processeur vidéo activé');
}

export function disableVideoProcessor(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isVideoProcessorOn() { return enabled; }
