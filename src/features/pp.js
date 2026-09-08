import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('PP');

const triggers = [
  /ma photo/i, /mon avatar/i, /photo de profil/i, /pp/i,
  /change.*ma photo/i, /ma pp/i, /voir.*ma photo/i
];

export function enablePP(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const sender = msg.key.participant || chat;
      try {
        const ppUrl = await sock.profilePictureUrl(sender, 'image');
        await sock.sendMessage(chat, { image: { url: ppUrl }, caption: `🖼️ @${sender.split('@')[0]}` });
      } catch {
        try { await sock.sendMessage(chat, { text: '❌ Pas de photo de profil.' }); } catch (_) {}
      }

      if (msg.message?.imageMessage) {
        const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
        if (!isOwner) continue;
        try {
          const buffer = await sock.downloadMediaMessage(msg);
          await sock.updateProfilePicture(sender, buffer);
          await sock.sendMessage(chat, { text: '✅ Photo de profil mise à jour !' });
          log.info(`PP changée pour ${sender}`);
        } catch (e) {
          await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
        }
      }
    }
  });

  log.info('Module pp actif (affiche/changement photo profil)');
}
