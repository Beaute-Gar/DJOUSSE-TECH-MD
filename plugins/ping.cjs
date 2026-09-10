const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'ping',
    alias: ['p'],
    desc: 'Vérifier la latence',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const start = Date.now();
    const msg = await conn.sendMessage(m.chat, { text: '> ping...' });
    const latency = Date.now() - start;
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const line = '━'.repeat(28);

    const text = `┏━⍟「 ☣ PING ☣ 」⍟━┓
┃ ▸ STATUS  : ONLINE 🟢
┃ ▸ LATENCE : ${latency}ms
┃ ▸ SERVEUR : ${os.hostname() || 'Render'}
┃ ▸ RAM     : ${mem} MB
┗${line}⍟
> root@${botName.toLowerCase()}:~$ _
> © DJOUSSE TECH EVOLUTION`;

    try {
        await conn.sendMessage(m.chat, { text, edit: msg.key });
    } catch (e) {
        await conn.sendMessage(m.chat, { text });
    }
});
