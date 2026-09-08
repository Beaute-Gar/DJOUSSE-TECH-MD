import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('MEDIADL');

const active = new Map();
const downDir = './downloads';
let total = 0;

const mediaTypes = [
  { key: 'imageMessage', ext: 'jpg' },
  { key: 'videoMessage', ext: 'mp4' },
  { key: 'audioMessage', ext: 'ogg' },
  { key: 'documentMessage', ext: 'bin' },
];

export async function startForGroup(sock, groupJid) {
  if (active.has(groupJid)) return false;
  await fs.mkdir(downDir, { recursive: true });
  const dir = path.join(downDir, groupJid.split('@')[0]);
  await fs.mkdir(dir, { recursive: true });
  active.set(groupJid, dir);

  sock.ev.on('messages.upsert', async (m) => {
    if (!active.has(groupJid)) return;
    for (const msg of m.messages || []) {
      if (msg.key?.remoteJid !== groupJid || msg.key?.fromMe) continue;
      for (const mt of mediaTypes) {
        if (msg.message?.[mt.key]) {
          try {
            const buf = await sock.downloadMediaMessage(msg);
            if (buf?.length) {
              const sender = (msg.key.participant || msg.key.remoteJid || '').split('@')[0];
              const filename = `${Date.now()}_${sender}.${mt.ext}`;
              await fs.writeFile(path.join(dir, filename), buf);
              total++;
            }
          } catch {}
          break;
        }
      }
    }
  });
  log.info(`Auto-download démarré pour ${groupJid}`);
  return true;
}

export function stopForGroup(groupJid) { active.delete(groupJid); }
export function getDlStats() {
  return { activeGroups: active.size, total, groups: [...active.keys()].map(j => ({ jid: j, dir: active.get(j) })) };
}
