import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CLOSE');

const triggerPhrases = [
  /ferme le groupe/i, /fermer le groupe/i, /close group/i,
  /trop de spam/i, /beaucoup de spam/i, /calmez vous/i
];

export function enableClose(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      if (!chat?.endsWith('@g.us')) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;
      const sender = msg.key.participant;
      if (!sender) continue;

      const meta = await sock.groupMetadata(chat).catch(() => null);
      if (!meta) continue;
      const isAdmin = meta.participants?.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
      const isOwner = sender.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '');
      if (!isAdmin && !isOwner) continue;

      if (triggerPhrases.some(p => p.test(text))) {
        const settings = await sock.groupSettingsUpdate(chat).catch(() => null);
        if (settings) {
          try {
            await sock.groupSettingUpdate(chat, 'announcement');
            log.info(`Groupe fermé par ${sender}`);
            await sock.sendMessage(chat, { text: '🔒 Groupe verrouillé. Seuls les admins peuvent écrire.\n\n👉 *Pour rouvrir:* "ouvre le groupe"' });
          } catch (_) {}
        } else {
          try {
            await sock.groupSettingUpdate(chat, 'announcement');
            log.info(`Groupe fermé par ${sender}`);
            await sock.sendMessage(chat, { text: '🔒 Groupe verrouillé.' });
          } catch (_) {}
        }
      }

      const reopenPattern = /ouvre le groupe/i;
      if (reopenPattern.test(text)) {
        try {
          await sock.groupSettingUpdate(chat, 'not_announcement');
          await sock.sendMessage(chat, { text: '🔓 Groupe rouvert. Tout le monde peut écrire.' });
        } catch (_) {}
      }
    }
  });

  log.info('Module close actif (suggestion admin: fermer/ouvrir groupe)');
}
