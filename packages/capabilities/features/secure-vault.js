import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('VAULT');
let listener = null, enabled = false;
const enc = t => Buffer.from(t).toString('base64').split('').reverse().join('');
const dec = t => { try { return Buffer.from(t.split('').reverse().join(''), 'base64').toString(); } catch { return null; } };
export function enableSecureVault(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, title TEXT, content TEXT, encrypted INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const jid = msg.key?.remoteJid, sender = msg.key?.participant || msg.key?.remoteJid, lower = text.toLowerCase();
      if (lower.startsWith('ajoute au coffre') || lower.startsWith('sauvegarde') || lower.startsWith('save vault')) {
        const parts = text.split(/ (?:ajoute au coffre|sauvegarde|save vault) /i).filter(Boolean);
        if (!parts.length) return;
        const content = parts[0], title = content.split(' ').slice(0, 5).join(' ') || 'Sans titre';
        rawRun('INSERT INTO vault (jid, title, content, encrypted) VALUES (?, ?, ?, 1)', sender, title, enc(content));
        sock.sendMessage(jid, { text: `🔐 *Coffre-fort : ${title}*\n✅ Sauvegardé et chiffré.` }, { quoted: msg });
      } else if (lower.includes('coffre') || lower.includes('vault')) {
        const items = rawAll('SELECT * FROM vault WHERE jid = ? ORDER BY created_at DESC LIMIT 5', sender);
        if (!items.length) { sock.sendMessage(jid, { text: '🔐 *Coffre-fort*\nAucune entrée. Envoie "ajoute au coffre [contenu]"' }, { quoted: msg }); return; }
        let reply = '🔐 *Coffre-fort*\n\n';
        for (const item of items) reply += `📌 ${item.title}\n${(dec(item.content) || '[?]').slice(0, 100)}\n\n`;
        sock.sendMessage(jid, { text: reply }, { quoted: msg });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Secure vault activé');
}
export function disableSecureVault(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
