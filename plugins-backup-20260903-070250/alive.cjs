const { cmd } = require('../command.cjs');
const os = require('os');
const config = require('../config-djousse.cjs');
const { box, uptime } = require('../lib/djousse-ui.cjs');
const { botImg } = require('../lib/botimg.cjs');

cmd({
    pattern: 'alive',
    desc: 'Statut du bot',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB';
    const version = config.VERSION || 'v2.1.0';
    const health = Math.max(0, Math.min(100, Math.round(100 - process.memoryUsage().rss / (256 * 1024 * 1024) * 100)));
    const text = box('💚 *BOT ACTIF*', [
        { label: 'Nom', value: `*${config.BOT_NAME || 'DJOUSSE TECH'}*` },
        { label: 'Version', value: `*${version}*` },
        { label: 'Statut', value: '✅ Opérationnel' },
        { label: 'Score santé', value: `*${health}/100*` },
        { label: 'Modèle IA', value: `*${config.AI_MODEL || 'AINORIA'}*` },
        { label: 'Uptime', value: `*${uptime(process.uptime())}*` },
        { label: 'RAM', value: ram },
    ], { footer: '> ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ ᴇᴠᴏʟᴜᴛɪᴏɴ' });
    const img = botImg();
    if (img) {
        try {
            await Promise.race([
                conn.sendMessage(m.chat, { image: img, caption: text }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('media timeout')), 8000)),
            ]);
        } catch (e) {
            try { await m.reply(text); } catch (e2) {}
        }
    } else {
        await m.reply(text);
    }
});
