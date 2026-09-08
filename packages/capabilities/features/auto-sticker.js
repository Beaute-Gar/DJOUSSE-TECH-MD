const userPrefs = new Map();

export function enableAutoSticker(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const sender = msg.key.participant || msg.key.remoteJid;
      if (!userPrefs.get(sender)) continue;
      const type = Object.keys(msg.message)[0];
      if (type !== 'imageMessage') continue;
      const count = userPrefs.get(sender)?.count || 0;
      if (count >= 10) return;
      userPrefs.set(sender, { enabled: true, count: count + 1 });
      await sock.sendMessage(msg.key.remoteJid, { text: '?? Auto-sticker activé (limite 10/jour)' });
    }
  });
}

export function toggleAutoSticker(sender, enabled) {
  userPrefs.set(sender, { enabled, count: 0 });
}
