import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('GUESTBOOK');
let listener = null, enabled = false;
export function enableGuestbook(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS guestbook (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, name TEXT, message TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const jid = msg.key?.remoteJid, sender = msg.key?.participant || msg.key?.remoteJid, lower = text.toLowerCase();
      if (lower.includes('livre d\'or') || lower.includes('guestbook')) {
        const content = text.replace(/livre d'or|guestbook/gi, '').trim();
        if (!content) {
          const entries = rawAll('SELECT * FROM guestbook ORDER BY RANDOM() LIMIT 3');
          if (!entries.length) { sock.sendMessage(jid, { text: '📖 *Livre d\'or*\nÉcris "livre d\'or [message]" pour laisser un mot.' }, { quoted: msg }); return; }
          let reply = '📖 *Livre d\'or*\n\n';
          for (const e of entries) reply += `👤 ${e.name || 'Anonyme'}: ${e.message.slice(0, 100)}\n📅 ${e.created_at}\n\n`;
          sock.sendMessage(jid, { text: reply }, { quoted: msg }); return;
        }
        const name = sender.split('@')[0];
        rawRun('INSERT INTO guestbook (jid, name, message) VALUES (?, ?, ?)', sender, name, content);
        sock.sendMessage(jid, { text: `📖 *Livre d'or*\n✅ ${name}, ton message a été ajouté !` }, { quoted: msg });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Guestbook activé');
}
export function disableGuestbook(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function getGuestbookEntries(limit = 5) { return rawAll('SELECT * FROM guestbook ORDER BY RANDOM() LIMIT ?', limit); }
