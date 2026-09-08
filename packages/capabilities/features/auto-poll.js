import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('AUTOPOLL');

let enabled = false;
let listener = null;
const lastPoll = new Map();

export function enableAutoPoll(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key?.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;
      if (Date.now() - (lastPoll.get(jid) || 0) < 3600000) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const lower = text.toLowerCase();
      let match = null;
      if (/(vous préférez|tu préfères|le meilleur|la meilleure).*(ou|vs)/i.test(lower)) {
        const parts = text.split(/(ou|vs|contre)/i);
        if (parts.length >= 3) {
          match = { question: parts[0].trim().slice(0, 100), options: parts.slice(2).map(p => p.trim().slice(0, 50)).filter(p => p.length > 0).slice(0, 5) };
        }
      }
      if (/(qui|quel|quelle)\s.*\?/i.test(lower) && /\b(d'accord|pensez|avis)\b/i.test(lower)) {
        match = { question: text.replace(/[?!]/g, '').trim().slice(0, 100), options: ['✅ Oui', '❌ Non', '🤷 Neutre'] };
      }
      if (match && match.options?.length >= 2) {
        sock.sendMessage(jid, { poll: { name: match.question, values: match.options.slice(0, 12), selectableCount: 1 } });
        lastPoll.set(jid, Date.now());
        log.info(`Auto-poll créé: ${match.question}`);
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Auto-poll activé');
}

export function disableAutoPoll(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isAutoPollOn() { return enabled; }
