import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('ANTISTICKER');
const groupConfigs = new Map();
export function enableAntiSticker(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      const jid = m.key?.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;
      const isSticker = !!m.message?.stickerMessage;
      if (!isSticker) continue;
      let config = groupConfigs.get(jid);
      if (config === undefined) {
        try {
          const db = (await import('../../infrastructure/database/database.js')).default;
          const row = db.prepare('SELECT value FROM group_settings WHERE jid=? AND key=?').get(jid, 'antisticker');
          config = row ? (row.value === 'true' || row.value === true) : false;
        } catch { config = false; }
        groupConfigs.set(jid, config);
      }
      if (!config) continue;
      const sender = m.key?.participant || m.key?.remoteJid;
      if (sender === sock.user?.id?.replace(/:.*@/, '@')) continue;
      try {
        await sock.sendMessage(jid, { delete: m.key });
        const name = m.pushName || sender?.split('@')[0] || 'Inconnu';
        await sock.sendMessage(jid, { text: `🚫 @${sender?.split('@')[0]} les stickers ne sont pas autorisés ici.`, mentions: [sender] });
        log.info(`Anti-sticker: supprimé de ${sender?.split('@')[0]} dans ${jid}`);
      } catch {}
    }
  });
  log.info('Anti-sticker activé');
}
export function setAntiSticker(jid, value) {
  groupConfigs.set(jid, value);
}
