const { cmd, commands } = require('../command.cjs');
const os = require("os");
const { runtime } = require('../lib/functions.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');
const style = require('../lib/style.cjs');

cmd({
    pattern: "info",
    desc: "Check uptime and system status",
    category: "main",
    react: "👑",
    filename: __filename
}, async (conn, m, commands, { from, sender, reply }) => {
    try {
        const totalCmds = commands.length;
        const uptime = () => {
            let sec = process.uptime();
            let h = Math.floor(sec / 3600);
            let m = Math.floor((sec % 3600) / 60);
            let s = Math.floor(sec % 60);
            return `${h}h ${m}m ${s}s`;
        };

        const status = style.box('DJOUSSE-TECH-MD INFO', [
            `MODE: ${config.MODE || 'public'}`,
            `OWNER: ${config.OWNER_NAME || 'Beaute Gar'}`,
            `PREFIX: ${config.PREFIX || '.'}`,
            `VERSION: 3.0.0`,
            `COMMANDS: ${totalCmds}`,
            `UPTIME: ${uptime()}`
        ]) + `\n\n> *DJOUSSE TECH EVOLUTION*`;

        await conn.sendMessage(from, {
            image: { url: randomImage() },
            caption: status,
            contextInfo: { mentionedJid: [sender], forwardingScore: 999, isForwarded: true }
        }, { quoted: m });
    } catch (e) {
        console.error("INFO COMMAND ERROR:", e);
        reply(style.error(`Error: ${e.message}`));
    }
});
