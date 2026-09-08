import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('SETPP');

export function enableSetPP(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!chat?.endsWith('@g.us')) continue;
      const sender = msg.key.participant;
      if (!sender) continue;
      const meta = await sock.groupMetadata(chat).catch(() => null);
      if (!meta) continue;
      const isAdmin = meta.participants?.some(p => p.id === sender && p.admin);
      if (!isAdmin) continue;

      const isPhotoReq = text && /photo.*groupe|change.*photo|set.*pp|pp.*groupe|photo.*profil.*groupe/i.test(text);
      const hasImage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

      if (!isPhotoReq && !hasImage) continue;

      const targetMsg = msg.message?.imageMessage ? msg : null;
      if (!targetMsg) {
        if (isPhotoReq) {
          try { await sock.sendMessage(chat, { text: '🖼️ Envoie l\'image pour la photo de groupe.' }); } catch (_) {}
        }
        continue;
      }

      try {
        const buffer = await sock.downloadMediaMessage(targetMsg);
        await sock.updateProfilePicture(chat, buffer);
        log.info(`Photo groupe changée ${chat}`);
        try { await sock.sendMessage(chat, { text: '✅ Photo de groupe mise à jour !' }); } catch (_) {}
      } catch (e) {
        try { await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }); } catch (_) {}
      }
    }
  });

  log.info('Module setpp actif (suggestion: envoyer image après demande)');
}
