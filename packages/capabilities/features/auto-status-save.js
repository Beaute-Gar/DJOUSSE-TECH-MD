export function enableAutoStatusSave(sock, owner) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid !== 'status@broadcast') continue;
      if (msg.key.fromMe) continue;
      if (!owner) continue;
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(r => setTimeout(r, delay));
      await sock.sendMessage(owner, { text: '?? Statut sauvegardé (view once ou média)' });
    }
  });
}
