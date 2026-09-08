import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('BLOCK');

const trustStore = new Map();
const BLOCK_THRESHOLD = 10;

export function enableBlock(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const jid = msg.key.participant || msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) continue;

      const trust = trustStore.get(jid) ?? 100;
      if (trust < BLOCK_THRESHOLD && !isBlocked(sock, jid)) {
        await sock.updateBlockStatus(jid, 'block');
        log.info(`Bloqué automatiquement: ${jid} (trust=${trust}%)`);
        try {
          await sock.sendMessage(jid, {
            text: '🚫 Vous avez été bloqué automatiquement pour comportement suspect.\nContactez l\'administrateur si vous pensez à une erreur.'
          });
        } catch (_) {}
      }
    }
  });
  log.info('Module block actif (seuil confiance < 10%)');
}

function isBlocked(sock, jid) {
  return false;
}

export function adjustTrust(jid, delta) {
  const current = trustStore.get(jid) ?? 100;
  const updated = Math.max(0, Math.min(100, current + delta));
  trustStore.set(jid, updated);
  return updated;
}
