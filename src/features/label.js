import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('LABEL');

const triggers = [/label/i, /étiquette/i, /etiquette/i, /tag/i, /catégorise/i, /categorise/i, /classe/i];

const autoLabels = [
  { pattern: /commande|achat|payer|payé|paiement/i, label: '💰 Client' },
  { pattern: /insulte|spam|arnaque|bloque/i, label: '🚫 Toxique' },
  { pattern: /merci|bravo|super|excellent/i, label: '😊 Positif' },
  { pattern: /aide|problème|bug|erreur|help/i, label: '🔧 Support' },
  { pattern: /combien|prix|tarif|devis/i, label: '💼 Prospect' },
  { pattern: /partenaire|collab|business/i, label: '🤝 Partenaire' },
];

const labelStore = new Map();

export function enableLabel(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const jid = msg.key.participant || msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !jid || jid.endsWith('@g.us')) continue;

      if (!labelStore.has(jid)) labelStore.set(jid, []);

      for (const { pattern, label } of autoLabels) {
        if (pattern.test(text)) {
          const labels = labelStore.get(jid);
          if (!labels.includes(label)) {
            labels.push(label);
            log.info(`Label ajouté à ${jid}: ${label}`);
          }
          break;
        }
      }
    }
  });

  log.info('Module label actif (classification automatique contacts)');
}

export function getLabels(jid) {
  return labelStore.get(jid) || [];
}
