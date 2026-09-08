import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('BACKUP');

const messages = new Map();
const backupDir = './backups/chats';
let enabled = false;
let listener = null;

export function enableBackup(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      const jid = msg.key?.remoteJid;
      if (!jid) continue;
      if (!messages.has(jid)) messages.set(jid, []);
      const arr = messages.get(jid);
      arr.push({ id: msg.key.id, fromMe: msg.key.fromMe, sender: msg.key.participant || jid, text: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Média]', ts: msg.messageTimestamp });
      if (arr.length > 1000) arr.splice(0, arr.length - 1000);
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Backup activé');
}

export function disableBackup(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }

export function isBackupOn() { return enabled; }

export async function saveChatToFile(sock, chatId) {
  await fs.mkdir(backupDir, { recursive: true });
  const arr = messages.get(chatId) || [];
  if (!arr.length) return null;
  let name = chatId.split('@')[0];
  if (chatId.endsWith('@g.us')) try { const meta = await sock.groupMetadata(chatId); name = meta.subject || name; } catch {}
  const safe = name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safe}_${Date.now()}.json`;
  await fs.writeFile(path.join(backupDir, filename), JSON.stringify({ chatId, name, exportedAt: new Date().toISOString(), total: arr.length, messages: arr }, null, 2));
  return { filename, total: arr.length };
}

export function searchChat(chatId, query) {
  const arr = messages.get(chatId) || [];
  const q = query.toLowerCase();
  return arr.filter(m => m.text.toLowerCase().includes(q));
}

export function getBackupStats() {
  let total = 0;
  for (const [, arr] of messages) total += arr.length;
  return { chats: messages.size, total };
}
