const config = require('../config-djousse.cjs');
const { cmd, commands } = require('../command.cjs');
const { sleep } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'restart',
    react: '♻️',
    desc: 'Restart the bot',
    category: 'OWNER',
    filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
    try {
        const owner = (config.BOT_OWNER || global.__sessionOwnerNumber || '') + '@s.whatsapp.net';
        if (m.sender !== owner) return reply(box('♻️ *REDÉMARRAGE*', [
            { raw: '❌ *Commande réservée à l\'owner du bot.*' },
        ]));
        await reply(box('♻️ *REDÉMARRAGE*', [
            { raw: '♻️ *Redémarrage du bot...*' },
        ]));
        await sleep(1500);
        const { exec } = require('child_process');
        exec('pm2 restart all');
    } catch (err) {
        console.error('Restart error:', err);
        reply(box('♻️ *REDÉMARRAGE*', [
            { raw: '❌ *Échec du redémarrage :*\n' + err },
        ]));
    }
});
