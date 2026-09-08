import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CONTACT');

const triggers = [/sauvegarde.*contact/i, /enregistre.*contact/i, /save.*contact/i, /ajoute.*contact/i, /vcard/i, /vcf/i];

export function enableContact(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || msg.key.participant
        || chat;

      const nameMatch = text.match(/contact[:\s]+(.+?)(?:$|avec|@)/i);
      const name = nameMatch ? nameMatch[1].trim().slice(0, 50) : target.split('@')[0];

      const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `TEL;type=CELL;type=VOICE;waid=${target.split('@')[0]}:+${target.split('@')[0]}`,
        'END:VCARD'
      ].join('\n');

      try {
        await sock.sendMessage(chat, {
          contacts: { displayName: name, contacts: [{ vcard }] }
        });
        log.info(`Contact créé: ${name}`);
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module contact actif (CRM intégré)');
}
