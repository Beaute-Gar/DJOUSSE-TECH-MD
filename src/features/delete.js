import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('DELETE');
const forbidden = [
  /@everyone/i, /@all/i, /@admin/i, /@tagall/i,
  /promote.*all/i, /demote.*all/i, /kick.*all/i, /remove.*all/i
];

export function enableDelete(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat?.endsWith('@g.us')) continue;
      const sender = msg.key.participant;
      if (!sender) continue;

      const isDanger = forbidden.some(p => p.test(text));
      if (!isDanger) continue;

      try {
        await sock.sendMessage(chat, { delete: msg.key });
        log.warn(`Message dangereux supprimé de ${sender}`);
        await sock.sendMessage(chat, {
          text: `⚠️ @${sender.split('@')[0]} — Les commandes dangereuses sont automatiquement supprimées.`,
          mentions: [sender]
        });
      } catch (_) {}
    }
  });

  log.info('Module delete actif (supprime messages dangereux @everyone, promote all, ...)');
}
