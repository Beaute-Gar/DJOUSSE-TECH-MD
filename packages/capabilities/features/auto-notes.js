import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('NOTES');
let listener = null, enabled = false;
export function enableAutoNotes(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, title TEXT, content TEXT, category TEXT DEFAULT 'general', created_at TEXT DEFAULT (datetime('now')))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const jid = msg.key?.remoteJid, sender = msg.key?.participant || msg.key?.remoteJid, lower = text.toLowerCase();
      if (lower.startsWith('note') || lower.startsWith('prends note') || lower.startsWith('souviens-toi')) {
        const content = text.replace(/^(note|prends note|souviens-toi)\s*/i, '').trim();
        if (!content) { sock.sendMessage(jid, { text: '📝 *Notes*\nEnvoie "note [contenu]" pour sauvegarder.' }, { quoted: msg }); return; }
        const title = content.split(' ').slice(0, 4).join(' ') || 'Note';
        rawRun('INSERT INTO notes (jid, title, content, category) VALUES (?, ?, ?, ?)', sender, title, content, 'general');
        sock.sendMessage(jid, { text: `📝 *Note sauvegardée :* ${title}` }, { quoted: msg });
      } else if (lower.includes('mes notes') || lower.includes('list notes') || lower === 'notes') {
        const items = rawAll('SELECT * FROM notes WHERE jid = ? ORDER BY created_at DESC LIMIT 10', sender);
        if (!items.length) { sock.sendMessage(jid, { text: '📝 *Notes*\nAucune note. Envoie "note [contenu]"' }, { quoted: msg }); return; }
        let reply = '📝 *Mes notes*\n\n';
        for (const item of items) reply += `#${item.id} ${item.title}\n${item.content.slice(0, 80)}...\n📅 ${item.created_at}\n\n`;
        sock.sendMessage(jid, { text: reply }, { quoted: msg });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Auto notes activé');
}
export function disableAutoNotes(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
