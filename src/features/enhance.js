import { createLogger } from '../../packages/infrastructure/logger.js';
import axios from 'axios';

const log = createLogger('ENHANCE');

const triggers = [/améliore.*image/i, /enhance/i, /améliore/i, /nettoie.*photo/i, /améliorer/i];

export function enableEnhance(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!chat) continue;

      const isRequest = text && triggers.some(p => p.test(text));
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const hasQuotedImage = quoted?.imageMessage;

      if (!isRequest || !hasQuotedImage) continue;

      try {
        try { await sock.sendMessage(chat, { text: '⏳ Amélioration de l\'image en cours...' }); } catch (_) {}

        const buffer = await sock.downloadMediaMessage({
          key: { remoteJid: chat, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
          message: quoted
        });

        const b64 = buffer.toString('base64');
        const res = await axios.post('https://api.deepai.org/api/torch-srgan', {
          image: b64
        }, { headers: { 'api-key': 'quickstart-QUdJIGlzIGNvbWluZy4uLi4K' }, timeout: 30000 }).catch(() => null);

        if (res?.data?.output_url) {
          const enhanced = await axios.get(res.data.output_url, { responseType: 'arraybuffer' });
          await sock.sendMessage(chat, { image: Buffer.from(enhanced.data), caption: '✨ Image améliorée !' });
          log.info('Image améliorée avec succès');
        } else {
          await sock.sendMessage(chat, { text: '❌ Service indisponible pour le moment.' });
        }
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module enhance actif');
}
