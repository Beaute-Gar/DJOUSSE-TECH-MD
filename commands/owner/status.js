const config = require('../config-djousse.cjs');
const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const statusQuotes = require('../../utils/statusQuotes');

cmd({
    pattern: 'status',
    react: '📢',
    desc: 'Publier une citation en statut WhatsApp (test immédiat)',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
    try {
        const ownerNum = (config.BOT_OWNER || config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const senderNum = (m.sender || '').split('@')[0].split(':')[0];
        if (senderNum !== ownerNum) return reply(boxWithFooter('ERREUR', [{ raw: 'Commande réservée au propriétaire.' }]));

        await reply(boxWithFooter('STATUS', [{ raw: '⏳ Publication en cours...' }]));

        const sessionId = config.sessionName || 'session';
        const ok = await statusQuotes.forcePublishNow(conn, sessionId);

        await reply(boxWithFooter(
            ok ? 'SUCCÈS' : 'ÉCHEC',
            [{ raw: ok ? '✅ Citation publiée en statut WhatsApp.' : '❌ Échec — voir les logs.' }]
        ));
    } catch (err) {
        console.error('Status command error:', err);
        reply(boxWithFooter('ERREUR', [{ raw: `❌ ${err.message}` }]));
    }
});
