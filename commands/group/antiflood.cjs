'use strict';

const { cmd } = require('../command.cjs');
const antiFlood = require('../../lib/anti-flood.cjs');

cmd({
    pattern: 'antiflood|af',
    react: '🌊',
    desc: 'Statistiques anti-flood',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const stats = antiFlood.getStats();
    await reply(
        `🌊 *Anti-Flood Stats*\n\n` +
        `📊 Utilisateurs suivis: ${stats.tracking}\n` +
        `⚠️ Avertissements: ${stats.warned}\n` +
        `🔇 Muets: ${stats.muted}\n\n` +
        `Règles: 5 msgs/10s = avertissement\n3 avertissements = muet 5min`
    );
});
