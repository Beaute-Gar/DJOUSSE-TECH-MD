import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('VIDEOCALL');

export function enableVideoCall(sock) {
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.isVideo && call.status === 'offer') {
        const from = call.from || call.jid;
        log.info(`Appel vidéo entrant de ${from} rejeté`);
        try {
          await sock.rejectCall(call.id, from);
          await sock.sendMessage(from, {
            text: '📹 Appel vidéo refusé.\n🎤 Utilise le message vocal ou le texte.\n\n> DJOUSSE TECH'
          });
        } catch (_) {}
      }
    }
  });

  log.info('Module videocall actif (rejet automatique des appels vidéo)');
}
