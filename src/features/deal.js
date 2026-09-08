import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('DEAL');

const deals = [];
let dealId = 0;
const triggers = [/deal/i, /offre/i, /opportunité/i, /opportunite/i, /affaire/i, /business/i];

export function enableDeal(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const isOwner = (msg.key.participant || chat)?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '');
      const hasInterest = /combien|prix|tarif|je veux|intéressé|intéresse/i.test(text);
      const hasOffer = /j'ai une offre|je propose|proposition|deal/i.test(text);

      if (hasInterest && !isOwner) {
        const sender = msg.key.participant || chat;
        deals.push({ id: ++dealId, from: sender, text: text.slice(0, 200), date: new Date().toISOString(), stage: 'lead' });
        log.info(`Nouveau lead: ${sender}`);
        try {
          await sock.sendMessage(chat, { text: '📈 Intérêt enregistré ! Un commercial vous contactera bientôt.' });
        } catch (_) {}
      }

      if (hasOffer && isOwner) {
        try {
          const active = deals.filter(d => d.stage !== 'closed');
          const summary = active.length
            ? active.map(d => `#${d.id} @${d.from.split('@')[0]} (${d.stage})`).join('\n')
            : 'Aucun deal actif.';
          await sock.sendMessage(chat, { text: `📊 *Pipeline commercial*\n${active.length} deals en cours\n\n${summary}` });
        } catch (_) {}
      }
    }
  });

  log.info('Module deal actif (détection opportunités commerciales)');
}
