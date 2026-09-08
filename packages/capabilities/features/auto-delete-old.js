export function enableAutoDeleteOld(sock) {
  setInterval(async () => {
    try {
      const chats = await sock.chats?.all?.() || [];
      for (const chat of chats) {
        if (!chat.id?.endsWith('@g.us')) continue;
        const msgs = await sock.loadMessages(chat.id, 50);
        for (const msg of msgs) {
          const age = Date.now() - (msg.messageTimestamp * 1000);
          if (age > 24 * 60 * 60 * 1000 && msg.key.fromMe) {
            await sock.sendMessage(chat.id, { delete: msg.key }).catch(() => {});
          }
        }
      }
    } catch {}
  }, 60 * 60 * 1000);
}
