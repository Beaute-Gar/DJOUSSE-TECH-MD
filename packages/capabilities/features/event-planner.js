import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('EVENT');

let listener = null;
let enabled = false;

export function enableEventPlanner(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, date TEXT, creator TEXT, group_jid TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      const keywords = ['on se voit', 'rendez-vous', 'réunion', 'rdv', 'event', 'evenement'];
      if (!keywords.some(k => text.includes(k))) continue;
      const sender = msg.key?.participant || msg.key?.remoteJid;
      const jid = msg.key?.remoteJid;
      const title = text.slice(0, 100);
      rawRun('INSERT INTO events (title, date, creator, group_jid) VALUES (?, datetime(\'now\'), ?, ?)', title, sender, jid);
      sock.sendMessage(jid, { text: `📅 *Événement enregistré !*\n"${title}"\n📌 Sauvegardé avec succès.` }, { quoted: msg });
      log.info(`Event saved: ${title}`);
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Event planner activé');
}

export function disableEventPlanner(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function listEvents(jid) {
  return rawAll('SELECT * FROM events WHERE group_jid = ? ORDER BY created_at DESC LIMIT 10', jid);
}
