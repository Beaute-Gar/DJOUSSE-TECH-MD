const warnCount = new Map();

export function enableAutoWarn(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const toxicWords = ['insulte', 'harcèlement', 'spam', 'racisme']; // extensible
      const isToxic = toxicWords.some(w => body.toLowerCase().includes(w));
      if (!isToxic) continue;
      await new Promise(r => setTimeout(r, 5000));
      const sender = msg.key.participant || msg.key.remoteJid;
      const current = (warnCount.get(sender) || 0) + 1;
      warnCount.set(sender, current);
      const admins = await sock.groupMetadata(msg.key.remoteJid).then(m => m.participants.filter(p => p.admin)).catch(() => []);
      for (const admin of admins) {
        await sock.sendMessage(admin.id, { text: `?? Auto-warn: @${sender.split('@')[0]} (${current}/3)`, mentions: [sender] }).catch(() => {});
      }
    }
  });
}
