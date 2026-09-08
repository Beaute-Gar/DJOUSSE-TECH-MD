export function enableAntiCall(sock) {
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        await sock.rejectCall(call.id, call.from);
        await sock.sendMessage(call.from, { text: 'Je ne peux pas prendre d\'appels. Envoie-moi un message.' });
      }
    }
  });
}
