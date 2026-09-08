import { createLogger } from '../../packages/infrastructure/logger.js';
import { adjustTrust } from './block.js';
import { isFeatureOn } from '../../packages/capabilities/features/feature-registry.js';

const log = createLogger('UNBLOCK');
const UNBLOCK_THRESHOLD = 50;
const positiveActions = new Set(['merci', 'merci beaucoup', 'bravo', 'super', 'bien joué', 'good', 'thanks', 'thank you']);

export function enableUnblock(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const jid = msg.key.participant || msg.key.remoteJid;
      if (!jid) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;

      const lower = text.toLowerCase();
      if (positiveActions.has(lower) || lower.includes('merci')) {
        const newTrust = adjustTrust(jid, +15);
        log.info(`Trust +15 pour ${jid} → ${newTrust}% (message positif)`);
        if (newTrust >= UNBLOCK_THRESHOLD) {
          try {
            await sock.updateBlockStatus(jid, 'unblock');
            log.info(`Débloqué automatiquement: ${jid} (trust=${newTrust}%)`);
            await sock.sendMessage(jid, {
              text: '✅ Vous avez été débloqué automatiquement ! Merci pour votre comportement positif.'
            });
          } catch (_) {}
        }
      }
    }
  });
  log.info('Module unblock actif (seuil déblocage > 50%)');
}
