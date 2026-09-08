export function enableAutoSaveMedia(sock, owner) {
  if (!owner) return;
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;
      const type = Object.keys(msg.message)[0];
      const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(type);
      if (!isMedia) continue;
      const media = msg.message[type];
      if (media && media.fileLength && parseInt(media.fileLength) < 1024 * 1024) continue;
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(r => setTimeout(r, delay));
      await sock.sendMessage(owner, { text: `?? Média reçu de ${msg.key.remoteJid}` }).catch(() => {});
    }
  });
}
