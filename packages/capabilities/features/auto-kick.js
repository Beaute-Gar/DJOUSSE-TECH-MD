const kickLog = new Map();

export function enableAutoKick(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const sender = msg.key.participant || msg.key.remoteJid;
      if (!sender || !msg.key.remoteJid?.endsWith('@g.us')) continue;
      const warns = parseInt(msg.message.conversation || '') || 0;
      if (warns >= 3) {
        await sock.sendMessage(msg.key.remoteJid, { text: "?? @ expulsé pour accumulation d'avertissements.", mentions: [sender] });
      }
    }
  });
}
