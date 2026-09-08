import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CALL');

export function enableCall(sock) {
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from || call.jid;
        log.info(`Appel entrant de ${from} rejeté`);
        try {
          await sock.rejectCall(call.id, from);
          await sock.sendMessage(from, {
            text: '📞 Désolé, je ne peux pas répondre aux appels.\n📝 Envoie-moi un message vocal ou texte à la place.\n\n> DJOUSSE TECH'
          });
        } catch (_) {}
      }
    }
  });

  log.info('Module call actif (rejet automatique des appels)');
}

export function enableVideoCall(sock) {
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.isVideo && call.status === 'offer') {
        const from = call.from || call.jid;
        log.info(`Appel vidéo entrant de ${from} rejeté`);
        try {
          await sock.rejectCall(call.id, from);
          await sock.sendMessage(from, {
            text: '📹 Appel vidéo refusé. Utilise le chat vocal ou texte.\n\n> DJOUSSE TECH'
          });
        } catch (_) {}
      }
    }
  });

  log.info('Module videocall actif (rejet automatique des appels vidéo)');
}
