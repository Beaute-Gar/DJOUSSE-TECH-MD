import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('DISAPPEAR');
const durations = { '24h': 86400, '7 jours': 604800, '7j': 604800, '90 jours': 7776000, '90j': 7776000, 'off': 0, 'non': 0, 'désactivé': 0 };

const triggers = [
  /messages éphémères/i, /disparaître/i, /disappear/i, /auto delete/i,
  /efface.*(?:les|mes)? messages/i, /disparition/i
];

export function enableDisappear(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat?.endsWith('@g.us')) continue;
      const sender = msg.key.participant;
      if (!sender) continue;
      const meta = await sock.groupMetadata(chat).catch(() => null);
      if (!meta) continue;
      const isAdmin = meta.participants?.some(p => p.id === sender && p.admin);
      if (!isAdmin) continue;
      if (!triggers.some(p => p.test(text))) continue;

      let dur = 86400;
      for (const [key, val] of Object.entries(durations)) {
        if (text.toLowerCase().includes(key)) { dur = val; break; }
      }

      try {
        await sock.groupToggleEphemeral(chat, dur);
        const label = Object.entries(durations).find(([k, v]) => v === dur)?.[0] || `${dur}s`;
        log.info(`Messages éphémères ${chat}: ${label}`);
        await sock.sendMessage(chat, { text: `⏳ Messages éphémères: ${dur === 0 ? '❌ Désactivé' : `✅ ${label}`}` });
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module disappear actif');
}
