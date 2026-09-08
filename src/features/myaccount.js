import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('MYACCOUNT');

const triggers = [
  /mon compte/i, /mon profil/i, /my account/i, /my profile/i,
  /mes infos/i, /qui suis-je/i, /informations/i
];

export function enableMyAccount(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const sender = msg.key.participant || chat;
      const name = (msg.pushName) || (await sock.sendMessage(sender, { text: '' }).then(() => sender.split('@')[0]).catch(() => sender.split('@')[0]));
      const pp = await sock.profilePictureUrl(sender, 'image').catch(() => null);

      let response = `👤 *Mon Compte*\n\n📛 Nom: ${msg.pushName || sender.split('@')[0]}`;
      response += `\n📱 Numéro: ${sender.split('@')[0]}`;
      response += `\n🆔 JID: ${sender}`;
      response += `\n📸 Photo: ${pp ? '✅' : '❌'}`;

      if (chat.endsWith('@g.us')) {
        try {
          const meta = await sock.groupMetadata(chat);
          const part = meta.participants?.find(p => p.id === sender);
          if (part) response += `\n👑 Rôle: ${part.admin === 'superadmin' ? '🌟 Créateur' : part.admin === 'admin' ? '👑 Admin' : '👤 Membre'}`;
          response += `\n👥 Groupe: ${meta.subject}`;
        } catch {}
      }

      try {
        if (pp) {
          await sock.sendMessage(chat, { image: { url: pp }, caption: response, mentions: [sender] });
        } else {
          await sock.sendMessage(chat, { text: response, mentions: [sender] });
        }
      } catch (_) {}
    }
  });

  log.info('Module myaccount actif');
}
