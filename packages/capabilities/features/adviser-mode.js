import { createLogger } from '../../infrastructure/logger.js';
import { askGroq } from '../../ainoria-intelligence/core/brain.js';
const log = createLogger('ADVISER');

let listener = null;
let enabled = false;

export function enableAdviserMode(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const lower = text.toLowerCase();
      if (!lower.includes('que faire') && !lower.includes('conseil') && !lower.includes('help me decide') && !lower.includes('que ferais-tu') && !lower.includes('avis')) continue;
      const jid = msg.key?.remoteJid;
      (async () => {
        try {
          const advice = await askGroq(
            'Tu es un conseier neutre et équilibré. Réponds en français avec des points positifs et négatifs. Sois concis (max 150 mots). Ne donne jamais de conseils dangereux ou illégaux.',
            `La personne demande un conseil: "${text}". Donne-lui des arguments pour et contre, puis une recommandation équilibrée.`
          );
          sock.sendMessage(jid, { text: `🧠 *Conseil*\n\n${advice}` }, { quoted: msg });
        } catch (e) {
          log.error(`Erreur conseil: ${e.message}`);
          sock.sendMessage(jid, { text: '🧠 *Conseil*\n\nDésolé, je n\'ai pas pu formuler de conseil pour le moment.' }, { quoted: msg });
        }
      })();
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Adviser mode activé');
}

export function disableAdviserMode(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
