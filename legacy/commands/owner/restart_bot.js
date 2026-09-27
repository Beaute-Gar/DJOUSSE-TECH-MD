const config = require('../config-djousse.cjs');
const { cmd } = require('../command.cjs');
const { sleep } = require('../lib/functions.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'restart',
    react: '♻️',
    desc: 'Redémarrer le bot',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
    try {
        const ownerNum = (config.BOT_OWNER || config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const senderNum = (m.sender || '').split('@')[0].split(':')[0];
        if (senderNum !== ownerNum) return reply(boxWithFooter('ERREUR', [{ raw: 'Commande réservée au propriétaire.' }]));
        await reply(boxWithFooter('RESTART', [{ raw: 'Redémarrage du bot...' }]));
        await sleep(1500);
        process.exit(0);
    } catch (err) {
        console.error('Restart error:', err);
        reply(boxWithFooter('ERREUR', [{ raw: 'Échec du redémarrage.' }]));
    }
});
