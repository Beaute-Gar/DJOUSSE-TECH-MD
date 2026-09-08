import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('VCF');

const triggers = [/exporte.*contact/i, /vcard/i, /vcf/i, /contact.*fichier/i, /export.*vcf/i, /télécharge.*contact/i];

export function enableVcf(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      let targets = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!targets.length) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) targets = [quoted];
      }

      if (!targets.length && chat.endsWith('@g.us')) {
        try {
          const meta = await sock.groupMetadata(chat);
          targets = meta.participants?.slice(0, 50).map(p => p.id) || [];
        } catch {}
      }

      if (!targets.length) {
        try { await sock.sendMessage(chat, { text: '👤 Qui veux-tu exporter ? Mentionne-le ou réponds à son message.' }); } catch (_) {}
        continue;
      }

      try {
        let vcards = '';
        for (const jid of targets.slice(0, 50)) {
          const name = (await sock.sendMessage(jid, { text: '' }).catch(() => null))
            ? jid.split('@')[0]
            : jid.split('@')[0];
          const pp = await sock.profilePictureUrl(jid, 'image').catch(() => '');
          vcards += [
            'BEGIN:VCARD', 'VERSION:3.0',
            `FN:${name}`,
            `TEL;type=CELL;type=VOICE;waid=${jid.split('@')[0]}:+${jid.split('@')[0]}`,
            pp ? `PHOTO;VALUE=URL;TYPE=JPEG:${pp}` : '',
            'END:VCARD\n'
          ].filter(Boolean).join('\n');
        }

        const { writeFileSync } = await import('fs');
        const path = `./database/${Date.now()}.vcf`;
        writeFileSync(path, vcards);

        await sock.sendMessage(chat, {
          document: { url: path },
          mimetype: 'text/vcard',
          fileName: `contacts_DJ.${targets.length}.vcf`,
          caption: `✅ ${targets.length} contact(s) exporté(s)`
        });
        log.info(`VCF exporté: ${targets.length} contacts`);
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur export: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module vcf actif');
}
