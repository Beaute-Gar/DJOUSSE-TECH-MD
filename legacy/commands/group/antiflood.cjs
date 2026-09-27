'use strict';

const { cmd } = require('../command.cjs');
const antiFlood = require('../../lib/anti-flood.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'antiflood|af',
    react: '🌊',
    desc: 'Statistiques anti-flood',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const stats = antiFlood.getStats();
    await reply(
        box('ANTI-FLOOD STATS', [
            '🌊 Anti-Flood Stats',
            '',
            '📊 Utilisateurs suivis: ' + stats.tracking,
            '⚠️ Avertissements: ' + stats.warned,
            '🔇 Muets: ' + stats.muted,
            '',
            'Règles: 5 msgs/10s = avertissement',
            '3 avertissements = muet 5min'
        ])
    );
});
