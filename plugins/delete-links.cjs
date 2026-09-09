const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'deletelinks|dellinks',
    desc: 'Toggle suppression automatique des liens dans le groupe',
    category: 'group',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isGroup) return m.reply('❌ Groupe uniquement');
    if (!m.isAdmin) return m.reply('❌ Admin uniquement');
    config.DELETE_LINKS = !config.DELETE_LINKS;
    m.reply(`✅ Delete-links: ${config.DELETE_LINKS ? 'activé' : 'désactivé'}`);
});

cmd({
    filter: (m) => {
        if (!config.DELETE_LINKS) return false;
        if (!m.isGroup) return false;
        if (m.isAdmin) return false;
        if (!m.message) return false;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || '';
        return /https?:\/\/[^\s]+|www\.[^\s]+/i.test(body);
    },
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        await ctx.conn.sendMessage(m.chat, { delete: m.key });
        await ctx.conn.sendMessage(m.chat, {
            text: `🔗 @${m.sender.split('@')[0]}, lien supprimé (non autorisé)`,
            mentions: [m.sender],
        });
    } catch (e) {}
});
