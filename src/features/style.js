import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('STYLE');

const triggers = [/stylise/i, /style/i, /transforme.*(texte|text)/i, /fais.*beau/i, /fancy/i, /joli.*texte/i];

function toFancy(text, offset) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D400 + offset + (code - 97));
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + offset + 26 + (code - 65));
    return c;
  }).join('');
}

const styles = {
  'bold': (t) => toFancy(t, 68),
  'italic': (t) => toFancy(t, 9),
  'bold italic': (t) => toFancy(t, 40),
  'script': (t) => t.split('').map(c => { const n = c.charCodeAt(0); if (n >= 97 && n <= 122) return String.fromCodePoint(0x1D4B6 + (n - 97)); if (n >= 65 && n <= 90) return String.fromCodePoint(0x1D4B6 + 26 + (n - 65)); return c; }).join(''),
  'double': (t) => toFancy(t, 20)
};

export function enableStyle(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      if (!targetText) targetText = text.replace(/stylise|style|transforme|fais beau|fancy|joli texte/gi, '').trim();
      if (!targetText || targetText.length < 2) {
        try { await sock.sendMessage(chat, { text: '🎨 Quel texte veux-tu styliser ?' }); } catch (_) {}
        continue;
      }

      const result = Object.entries(styles).map(([name, fn]) => `*${name}*: ${fn(targetText)}`).join('\n\n');
      try {
        await sock.sendMessage(chat, { text: `🎨 *${targetText}* stylisé:\n\n${result}` });
      } catch (_) {}
    }
  });

  log.info('Module style actif');
}
