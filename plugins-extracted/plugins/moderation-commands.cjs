const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { getModeration } = require('../src/services/proactive-moderation.cjs');

/* ══ Commandes Modération Proactive ══ */

cmd({
    pattern: 'mod status',
    alias: ['moderation status', 'mod info'],
    desc: 'État de la modération proactive',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const mod = getModeration();
    const text = `🛡️ *Modération Proactive*\n\n` +
        `📊 *Statut:* ${mod.enabled ? '✅ Activée' : '❌ Désactivée'}\n` +
        `⚠️ *Warnings max:* ${mod.enabled ? '3' : 'N/A'}\n` +
        `📝 *Logs audit:* ${mod.auditLog.length}`;
    
    await m.reply(text);
});

cmd({
    pattern: 'mod on',
    alias: ['enable mod', 'activer mod'],
    desc: 'Activer la modération proactive',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const mod = getModeration();
    mod.setEnabled(true);
    await m.reply('🛡️ Modération proactive **activée**.');
});

cmd({
    pattern: 'mod off',
    alias: ['disable mod', 'desactiver mod'],
    desc: 'Désactiver la modération proactive',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const mod = getModeration();
    mod.setEnabled(false);
    await m.reply('🛡️ Modération proactive **désactivée**.');
});

cmd({
    pattern: 'mod logs',
    alias: ['mod audit'],
    desc: 'Voir les logs de modération',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const mod = getModeration();
    const logs = mod.getAuditLog(20);
    
    if (logs.length === 0) {
        return m.reply('🛡️ Aucun log de modération.');
    }
    
    const text = `🛡️ *Logs Modération*\n\n` +
        logs.map(l => `• [${l.event}] ${l.userId || 'system'} — ${l.reason || ''}`).join('\n');
    
    await m.reply(text);
});

cmd({
    pattern: 'warn',
    alias: ['warn user'],
    desc: 'Avertir un utilisateur',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const mod = getModeration();
    const rawTarget = String(m.body || '').replace(/^\.?warn\s*/i, '').trim();
    const mentioned = m.mentionedJid?.[0] || rawTarget.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    if (!mentioned || mentioned === '@s.whatsapp.net') {
        return m.reply('Usage: .warn @utilisateur');
    }
    
    const result = mod.addWarning(m.chat, mentioned, 'Warn manuel par owner');
    
    await m.reply(`⚠️ Warning ${result.count}/3 pour @${mentioned.split('@')[0]}`);
    
    if (result.shouldKick) {
        try {
            await conn.groupParticipantsUpdate(m.chat, [mentioned], 'remove');
            await m.reply(`👢 Utilisateur expulsé après 3 warnings.`);
        } catch (e) {
            await m.reply('❌ Impossible d\'expulser l\'utilisateur.');
        }
    }
});

module.exports = {};
