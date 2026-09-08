import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('SELECT');

const triggers = [
  /choisi pour moi/i, /choisis/i, /select/i, /quel.*choisir/i,
  /décide/i, /quel.*meilleur/i, /que dois.je/i
];

export function enableSelect(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const options = text.split(',').map(s => s.trim().replace(/^choisis? pour moi\s*/i, '').replace(/^(quel|que)\s.+?\s/gi, '')).filter(s => s.length > 2);

      if (options.length >= 2) {
        const chosen = options[Math.floor(Math.random() * options.length)];
        try {
          await sock.sendMessage(chat, {
            text: `🎯 *Je te conseille:* **${chosen}**\n\n(${options.map((o, i) => `${i + 1}. ${o}`).join(' | ')})`
          });
          log.info(`Sélection: ${chosen}`);
        } catch (_) {}
      } else if (options.length === 1) {
        try { await sock.sendMessage(chat, { text: `🤔 Tu n'as donné qu'une option. Donne-moi plusieurs choix séparés par des virgules.` }); } catch (_) {}
      }
    }
  });

  log.info('Module select actif');
}
