'use strict';

const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const os = require('os');

cmd({
    pattern: 'os',
    alias: ['djousse os', 'system', 'control'],
    desc: 'Centre de contrôle DJOUSSE OS',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const min = Math.floor((uptime % 3600) / 60);
    const sec = Math.floor(uptime % 60);
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const cpus = os.cpus().length;
    const platform = os.platform();

    const modules = [
        { name: 'AINORIA MEMORY', status: true, icon: '🧠' },
        { name: 'GUARDIAN', status: true, icon: '🛡️' },
        { name: 'AUTO-REACT', status: !!config.AUTO_STATUS_REACT, icon: '❤️' },
        { name: 'AUTO-TYPING', status: config.AUTO_TYPING === 'true', icon: '⌨️' },
        { name: 'AUTO-RECORDING', status: config.AUTO_RECORDING === 'true', icon: '🎙️' },
        { name: 'ANTI-LINK', status: config.ANTI_LINK !== false, icon: '🔗' },
        { name: 'ANTI-DELETE', status: config.ANTI_DELETE !== false, icon: '🗑️' },
        { name: 'ANTI-SPAM', status: config.ANTI_SPAM === true, icon: '🚫' },
    ];

    const modList = modules.map(m =>
        `┃ ${m.icon} ${m.name.padEnd(18)} ${m.status ? '🟢' : '🔴'}`
    ).join('\n');

    return reply(
        `┏━⍟「 ☣ DJOUSSE OS ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🧠 AINORIA      🟢 ONLINE\n` +
        `┃ 🛡️ SECURITY     🟢 ACTIVE\n` +
        `┃ 💾 MEMORY       ${mem} MB\n` +
        `┃ ⏱️ UPTIME       ${h}h ${min}m ${sec}s\n` +
        `┃ 🖥️ PLATFORM     ${platform}\n` +
        `┃ 🧮 CPU          ${cpus} cores\n` +
        `┃ 📦 PLUGINS      ${commands.length || '195'}\n` +
        `┃\n` +
        `┃ ─── MODULES ───────────────\n` +
        modList + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

module.exports = {};
