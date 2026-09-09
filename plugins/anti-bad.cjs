const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'antibad|badwords',
    desc: 'Toggle anti-mots interdits',
    category: 'group',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isGroup) return m.reply('❌ Groupe uniquement');
    if (!m.isAdmin) return m.reply('❌ Admin uniquement');
    config.ANTI_BAD = !config.ANTI_BAD;
    m.reply(`✅ Anti-mots interdits: ${config.ANTI_BAD ? 'activé' : 'désactivé'}`);
});

cmd({
    pattern: 'addbad|addbadword',
    desc: 'Ajouter un mot interdit',
    category: 'group',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isGroup) return m.reply('❌ Groupe uniquement');
    if (!m.isAdmin) return m.reply('❌ Admin uniquement');
    const word = m.args.join(' ').trim().toLowerCase();
    if (!word) return m.reply('❌ Usage: .addbad <mot>');
    if (config.ANTI_BAD_WORDS.includes(word)) return m.reply('❌ Mot déjà interdit');
    config.ANTI_BAD_WORDS.push(word);
    m.reply(`✅ Mot interdit ajouté: ${word}`);
});

cmd({
    pattern: 'delbad|delbadword',
    desc: 'Supprimer un mot interdit',
    category: 'group',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isGroup) return m.reply('❌ Groupe uniquement');
    if (!m.isAdmin) return m.reply('❌ Admin uniquement');
    const word = m.args.join(' ').trim().toLowerCase();
    if (!word) return m.reply('❌ Usage: .delbad <mot>');
    const idx = config.ANTI_BAD_WORDS.indexOf(word);
    if (idx === -1) return m.reply('❌ Mot non trouvé');
    config.ANTI_BAD_WORDS.splice(idx, 1);
    m.reply(`✅ Mot interdit supprimé: ${word}`);
});

cmd({
    filter: (m) => {
        if (!config.ANTI_BAD) return false;
        if (!m.isGroup) return false;
        if (m.isAdmin) return false;
        if (!m.message) return false;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase();
        return config.ANTI_BAD_WORDS.some(w => body.includes(w));
    },
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        await ctx.conn.sendMessage(m.chat, { delete: m.key });
        await ctx.conn.sendMessage(m.chat, {
            text: `⚠️ @${m.sender.split('@')[0]}, message supprimé (mot interdit)`,
            mentions: [m.sender],
        });
    } catch (e) {}
});
