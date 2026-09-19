const { cmd, commands } = require('../command.cjs');
const os = require("os");
const { runtime } = require('../lib/functions.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');
const { box } = require('../lib/djousse-ui.cjs');

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

        const status = box('DJOUSSE-TECH-MD INFO', [
            { label: 'MODE', value: config.MODE || 'public' },
            { label: 'OWNER', value: config.OWNER_NAME || 'Beaute Gar' },
            { label: 'PREFIX', value: config.PREFIX || '.' },
            { label: 'VERSION', value: '3.0.0' },
            { label: 'COMMANDS', value: totalCmds },
            { label: 'UPTIME', value: uptime() },
        ], 40) + `\n\n> *DJOUSSE TECH EVOLUTION*`;

        await conn.sendMessage(from, {
            image: { url: randomImage() },
            caption: status,
            contextInfo: { mentionedJid: [sender], forwardingScore: 999, isForwarded: true }
        }, { quoted: m });
    } catch (e) {
        console.error("INFO COMMAND ERROR:", e);
        reply(box('ERROR', [{ raw: `Error: ${e.message}` }]));
    }
});
