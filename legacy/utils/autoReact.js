const config = require('../config');

const autoReact = async (sock, msg) => {
  if (!config.autoReact || msg.key.fromMe) return;
  
  try {
    const emojis = ['❤️', '🔥', '👌', '💀', '😁', '✨', '👍', '😎', '😂', '🤝'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key }
    });
  } catch (e) {}
};

module.exports = { autoReact };