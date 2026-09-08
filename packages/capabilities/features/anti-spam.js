const spamTracker = new Map();

export function enableAntiSpam(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const sender = msg.key.participant || msg.key.remoteJid;
      if (!sender) continue;
      const now = Date.now();
      if (!spamTracker.has(sender)) spamTracker.set(sender, []);
      const timestamps = spamTracker.get(sender).filter(t => now - t < 3000);
      timestamps.push(now);
      spamTracker.set(sender, timestamps);
      if (timestamps.length > 5) {
        spamTracker.set(sender, []);
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  });
}
