'use strict';

const { cmd } = require('../command.cjs');
const autoreact = require('../../lib/autoreact.cjs');

cmd({
    pattern: 'autoreact',
    alias: ['statusreact', 'ar'],
    react: '❤️',
    desc: 'Auto-react to WhatsApp statuses',
    category: 'tools',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    return reply('✅ Auto-React Status activé\nEmojis: ❤️ 🔥 💕 💖 💘 💞 💓 💗 👀 🫠 🙀 💛');
});

module.exports = {
    initializeAutoReact: (conn) => autoreact.init(conn)
};
