const replies = [
  'Besoin d\'aide ? Tape .menu pour voir mes commandes.',
  'Je suis là ! Que puis-je faire pour toi ?',
  '?? Salut ! Comment puis-je t\'aider ?',
  'Je t\'écoute !',
  '?? DJOUSSE TECH à ton service !'
];

export function enableAutoReplyMention(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (body.includes('@' + sock.user?.id?.split(':')[0])) {
        const delay = Math.floor(Math.random() * 4000) + 3000;
        await new Promise(r => setTimeout(r, delay));
        const reply = replies[Math.floor(Math.random() * replies.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
      }
    }
  });
}
