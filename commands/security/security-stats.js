const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { getSecurityStats, resetSecurityState } = require('../src/middleware/security.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;

/* ══ Commande .security — Stats anti-ban ══
   Affiche les compteurs de sécurité et l'état du warm-up. */

cmd({
    pattern: 'securitestats',
    alias: ['securitystats', 'antiban-stats'],
    desc: 'Afficher les stats de sécurité anti-ban',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    // Owner only
    const ownerNumbers = [
        config.OWNER_NUMBER,
        config.OWNER_NUMBER_2,
        process.env.OWNER_NUMBER,
    ].filter(Boolean).map(n => String(n).replace(/[^0-9]/g, ''));
    
    const senderNum = String(m.sender).split('@')[0].replace(/[^0-9]/g, '');
    if (!ownerNumbers.includes(senderNum)) {
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée au owner.' }]));
    }
    
    try {
        const stats = getSecurityStats();
        
        const lines = [
            box('🛡️ *SECURITY STATUS — ANTI-BAN*', [
                { label: '📱 Âge du compte', value: stats.accountAge },
                { label: '🔥 Warm-up', value: stats.warmupComplete ? '✅ Complet' : '⏳ En cours' },
                { label: '📊 Limite warm-up', value: String(stats.warmupLimit) },
            ]),
            '',
            '📈 *Compteurs journaliers :*',
            `  💬 DM: ${stats.daily.private}/${config.DAILY_LIMIT_PRIVATE || 200}`,
            `  👥 Groupes: ${stats.daily.group}/${config.DAILY_LIMIT_GROUP || 100}`,
            '',
            '⏰ *Compteurs horaires :*',
            `  💬 DM: ${stats.hourly.private}/${config.HOURLY_LIMIT_PRIVATE || 30}`,
            `  👥 Groupes: ${stats.hourly.group}/${config.HOURLY_LIMIT_GROUP || 15}`,
            '',
            `📊 *Total envoyé:* ${stats.totalSent}`,
            `🚫 *Rate-limits:* ${stats.blockedCount}`,
            '',
            '⚙️ Commandes:',
            `  ${config.PREFIX || '.'}security reset — Réinitialiser les compteurs`,
        ];
        
        await m.reply(lines.join('\n'));
    } catch (e) {
        await m.reply(boxWithFooter('ERREUR', [{ raw: `❌ Erreur lecture stats: ${e.message}` }]));
    }
});

cmd({
    pattern: 'security reset',
    desc: 'Réinitialiser les compteurs de sécurité',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const ownerNumbers = [
        config.OWNER_NUMBER,
        config.OWNER_NUMBER_2,
        process.env.OWNER_NUMBER,
    ].filter(Boolean).map(n => String(n).replace(/[^0-9]/g, ''));
    
    const senderNum = String(m.sender).split('@')[0].replace(/[^0-9]/g, '');
    if (!ownerNumbers.includes(senderNum)) {
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée au owner.' }]));
    }
    
    try {
        resetSecurityState();
        await m.reply(boxWithFooter('SUCCÈS', [{ raw: '✅ Compteurs de sécurité réinitialisés.' }]));
    } catch (e) {
        await m.reply(boxWithFooter('ERREUR', [{ raw: `❌ Erreur reset: ${e.message}` }]));
    }
});

module.exports = {};
