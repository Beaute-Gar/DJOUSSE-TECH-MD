import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('BIZ');

export function enableBiz(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;

      if (!/business|biz|profil (commercial|entreprise|pro)/i.test(text)) continue;

      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.key.participant || chat;
      try {
        const biz = await sock.getBusinessProfile(target);
        if (!biz) {
          await sock.sendMessage(chat, { text: '❌ Ce numéro n\'a pas de profil business.' });
          return;
        }
        let response = `🏢 *Profil Business*\n\n📛 *${biz.name || 'Anonyme'}*\n`;
        if (biz.description) response += `📝 ${biz.description.slice(0, 200)}\n`;
        if (biz.website) response += `🌐 ${biz.website}\n`;
        if (biz.email) response += `📧 ${biz.email}\n`;
        if (biz.address) response += `📍 ${biz.address}\n`;
        if (biz.categories?.length) response += `🏷️ ${biz.categories.join(', ')}\n`;
        await sock.sendMessage(chat, { text: response });
        log.info(`Profil business affiché pour ${target}`);
      } catch {
        await sock.sendMessage(chat, { text: '❌ Impossible de récupérer le profil business.' }).catch(() => {});
      }
    }
  });

  log.info('Module biz actif (détection auto profils business)');
}
