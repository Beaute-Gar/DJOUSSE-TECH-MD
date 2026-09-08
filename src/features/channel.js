import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CHANNEL');

const triggers = [/chaîne/i, /chaine/i, /channel/i, /newsletter/i];

export function enableChannel(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const isOwner = (msg.key.participant || chat)?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;

      try {
        const subs = await sock.newsletterSubscriptions().catch(() => null);
        const list = subs?.length
          ? subs.map(s => `  • ${s.name || s.id}`).join('\n')
          : 'Aucune chaîne suivie.';

        let response = `📡 *Chaînes WhatsApp*\n\n📋 Abonnements:\n${list}`;

        if (isOwner) {
          response += '\n\n💡 Pour suivre une chaîne, envoie son lien ou son ID.';
        }

        await sock.sendMessage(chat, { text: response });
        log.info('Infos chaînes affichées');
      } catch {
        await sock.sendMessage(chat, { text: '❌ Fonctionnalité chaîne indisponible.' }).catch(() => {});
      }
    }
  });

  log.info('Module channel actif');
}
