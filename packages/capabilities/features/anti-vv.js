const viewOnceLog = new Map();

export function enableAntiVV(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const type = Object.keys(msg.message)[0];
      if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
        const delay = Math.floor(Math.random() * 3000) + 2000;
        await new Promise(r => setTimeout(r, delay));
        const chat = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;
        if (!fromMe && viewOnceLog.size < 100) {
          viewOnceLog.set(msg.key.id, { chat, timestamp: Date.now() });
        }
      }
    }
  });
}
