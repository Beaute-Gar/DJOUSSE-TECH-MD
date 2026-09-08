import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll, rawGet } from '../../infrastructure/database/database.js';
const log = createLogger('FIRSTAID');

const DISTRESS = ['aide', 'urgence', 'suicide', 'détresse', 'détresse', 'au secours', 'help me', 'sos', 'appel d\'urgence'];
const EMERGENCY = { '112': '📞 *Centre d\'urgence (Europe/Cameroun)*', '117': '👮 *Police*', '118': '🚒 *Pompiers*', '119': '🚑 *SAMU / Urgences médicales*' };

let enabled = false, listener = null;

export function enableFirstAid(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS emergency_contacts (jid TEXT, name TEXT, number TEXT, PRIMARY KEY(jid, number))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      if (!DISTRESS.some(d => text.includes(d))) continue;
      const jid = msg.key.remoteJid;
      let reply = '🚨 *URGENCE — Numéros à contacter immédiatement*\n\n';
      for (const [num, label] of Object.entries(EMERGENCY)) reply += `${label}: *${num}*\n`;
      const contacts = rawAll('SELECT name, number FROM emergency_contacts WHERE jid = ?', jid);
      if (contacts.length) { reply += '\n📇 *Tes contacts d\'urgence:*\n'; contacts.forEach(c => reply += `  • ${c.name}: ${c.number}\n`); }
      reply += '\n🙏 *Reste calme. Tu n\'es pas seul(e).*';
      sock.sendMessage(jid, { text: reply });
      if (text.includes('suicide')) sock.sendMessage(jid, { text: '🆘 *Ligne d\'écoute:* 1515 (Allô Enfance en Danger), +237 670 000 000 (Ligne Verte CAMTEL).' });
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Premiers secours activé');
}

export function addEmergencyContact(jid, name, number) { rawRun('INSERT OR IGNORE INTO emergency_contacts VALUES (?, ?, ?)', jid, name, number); }
export function removeEmergencyContact(jid, number) { rawRun('DELETE FROM emergency_contacts WHERE jid = ? AND number = ?', jid, number); }
export function disableFirstAid(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isFirstAidOn() { return enabled; }
