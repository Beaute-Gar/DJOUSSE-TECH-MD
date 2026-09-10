const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
}

cmd({
    pattern: 'alive',
    alias: ['bot'],
    desc: 'Statut du bot',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const up = fmtUptime(process.uptime());
    const version = config.VERSION || 'v3.1.0';
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const ownerName = config.OWNER_NAME || 'DJOUSSSE';
    const line = '━'.repeat(28);

    const text = `┏━⍟「 ☣ ${botName} ☣ 」⍟━┓
┃ ▸ STATUS  : ONLINE 🟢
┃ ▸ VERSION : ${version}
┃ ▸ OWNER   : ${ownerName}
┃ ▸ UPTIME  : ${up}
┃ ▸ RAM     : ${mem} MB
┃ ▸ SYSTEM  : ${os.type()} ${os.release()}
┗${line}⍟
> root@${botName.toLowerCase()}:~$ _
> © DJOUSSE TECH EVOLUTION`;

    await m.reply(text);
});
