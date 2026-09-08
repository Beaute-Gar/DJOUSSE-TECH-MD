import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('BDAY');

let listener = null;
let enabled = false;
let ownerJid = null;

export function enableBirthdayReminder(sock, owner) {
  if (enabled) return;
  enabled = true;
  ownerJid = owner;
  rawRun(`CREATE TABLE IF NOT EXISTS birthdays (jid TEXT, name TEXT, date TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      const sender = msg.key?.participant || msg.key?.remoteJid;
      const jid = msg.key?.remoteJid;
      if (text.includes('joyeux anniversaire') || text.includes('bon anniv') || text.includes('happy birthday')) {
        const nameMatch = text.match(/(joyeux anniversaire|bon anniv|happy birthday)\s*(@?\S+)/i);
        const name = nameMatch ? nameMatch[2] : sender.split('@')[0];
        const existing = rawGet('SELECT * FROM birthdays WHERE jid = ?', sender);
        if (!existing) {
          rawRun('INSERT INTO birthdays (jid, name, date) VALUES (?, ?, datetime(\'now\'))', sender, name);
          sock.sendMessage(jid, { text: `🎂 *Anniversaire enregistré !*\n${name} — je m'en souviendrai l'année prochaine 🎉` }, { quoted: msg });
        } else {
          sock.sendMessage(jid, { text: `🎉 Joyeux anniversaire ${name} ! 🎂` }, { quoted: msg });
        }
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Birthday reminder activé');
}

export function disableBirthdayReminder(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function getBirthdays() {
  return rawAll('SELECT * FROM birthdays ORDER BY date DESC');
}
