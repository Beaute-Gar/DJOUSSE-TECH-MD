import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('PREFIX');

const triggers = [
  /change.*préfixe/i, /change.*prefix/i, /nouveau préfixe/i,
  /nouveau prefix/i, /préfixe/i, /prefixe/i
];

export function enablePrefix(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const match = text.match(/["""]?([^\s,"""]+)["""]?\s*(comme|en|->)?/i);
      const newPrefix = match?.[1] || text.match(/préfixe[:\s]*([^\s,.!?]+)/i)?.[1];

      if (newPrefix && newPrefix.length >= 1 && newPrefix.length <= 2 && newPrefix !== process.env.PREFIX) {
        const old = process.env.PREFIX;
        process.env.PREFIX = newPrefix;
        try {
          await sock.sendMessage(chat, { text: `✅ Préfixe changé: "${old}" → "${newPrefix}"\nUtilise "${newPrefix}menu" pour voir les commandes.` });
          log.info(`Préfixe changé: ${old} → ${newPrefix}`);
        } catch (_) {}
      } else {
        try {
          await sock.sendMessage(chat, { text: `🔣 Préfixe actuel: "${process.env.PREFIX || '.'}"\nDis "change préfixe #" pour utiliser # comme nouveau préfixe.` });
        } catch (_) {}
      }
    }
  });

  log.info('Module prefix actif');
}
