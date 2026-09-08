const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

cmd({
    pattern: "ping",
    alias: ["p"],
    desc: "Check bot speed",
    category: "main",
    react: "🏓",
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    const start = Date.now();
    const sent = await conn.sendMessage(from, { text: "🏓 Pinging..." }, { quoted: m });
    const speed = Date.now() - start;

    const text =
        `╭━━━〔 ${config.BOT_NAME || 'DJOUSSE-TECH-MD'} 〕\n` +
        `│\n` +
        `│ 🏓 Pong!\n` +
        `│\n` +
        `│ ⚡ Speed: ${speed}ms\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━➤\n\n` +
        `${config.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION'}`;

    await conn.sendMessage(from, { text, edit: sent.key }, {}).catch(async () => {
        await conn.sendMessage(from, { text }, { quoted: m });
    });
});
