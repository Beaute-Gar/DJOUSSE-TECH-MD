import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('ALERT');

const words = new Set(['arnaque', 'scam', 'piratage', 'hack', 'signalé']);
let listener = null;
let enabled = false;
const history = [];
let ownerJid = null;

export function setOwner(jid) { ownerJid = jid; }

export function addWord(w) { words.add(w.toLowerCase().trim()); }
export function removeWord(w) { return words.delete(w.toLowerCase().trim()); }
export function listWords() { return [...words]; }

export function enableAlerts(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      for (const word of words) {
        if (text.includes(word)) {
          const sender = msg.key?.participant || msg.key?.remoteJid;
          const jid = msg.key?.remoteJid;
          const entry = { word, sender: (sender || '').split('@')[0], text: text.slice(0, 200), ts: Date.now() };
          history.push(entry);
          log.info(`Alerte: "${word}" de ${entry.sender}`);
          if (ownerJid) {
            sock.sendMessage(ownerJid, { text: `🚨 *ALERTE*\nMot: "${word}"\nDe: ${entry.sender}\nMessage: ${entry.text}` });
          }
          break;
        }
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Alertes activées');
}

export function disableAlerts(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isAlertOn() { return enabled; }
export function getAlertHistory() { return history.slice(-20); }
