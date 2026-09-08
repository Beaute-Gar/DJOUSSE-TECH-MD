import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('DIRECTORY');

const triggers = [/annuaire/i, /directory/i, /liste.*membre/i, /qui.*dans.*groupe/i, /membres/i, /participants/i];

export function enableDirectory(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat?.endsWith('@g.us')) continue;
      if (!triggers.some(p => p.test(text))) continue;

      try {
        const meta = await sock.groupMetadata(chat);
        const members = meta.participants || [];
        const admins = members.filter(p => p.admin);
        const regular = members.filter(p => !p.admin);

        let response = `👥 *Annuaire — ${meta.subject}*\n\n`;
        response += `👑 Admins (${admins.length}):\n`;
        admins.slice(0, 15).forEach(p => response += `  @${p.id.split('@')[0]}\n`);

        response += `\n👤 Membres (${regular.length}):\n`;
        regular.slice(0, 20).forEach(p => response += `  @${p.id.split('@')[0]}\n`);

        if (members.length > 35) response += `\n... et ${members.length - 35} autres`;

        await sock.sendMessage(chat, {
          text: response,
          mentions: members.slice(0, 35).map(p => p.id)
        });
        log.info(`Annuaire affiché: ${members.length} membres`);
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module directory actif');
}
