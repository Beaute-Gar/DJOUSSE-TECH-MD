const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'mentionreply|mention',
    desc: 'Toggle réponse quand le bot est mentionné',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isOwner) return m.reply(boxWithFooter('ERROR', [{ raw: '❌ Owner only' }]));
    config.MENTION_REPLY = !config.MENTION_REPLY;
    m.reply(boxWithFooter('MENTION-REPLY', [{ raw: `✅ Mention-reply: ${config.MENTION_REPLY ? 'activé' : 'désactivé'}` }]));
});

cmd({
    filter: (m) => {
        if (!config.MENTION_REPLY) return false;
        if (!m.message) return false;
        if (m.fromMe) return false;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        const mentions = m.message.extendedTextMessage?.mentionedJid || [];
        const botJid = m.conn?.user?.id?.replace(/:\d+/, '') || '';
        if (mentions.includes(botJid)) return true;
        if (text.includes('@' + (botJid.split('@')[0]))) return true;
        return false;
    },
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        await ctx.conn.sendMessage(m.chat, {
            text: boxWithFooter('MENTION', [{ raw: config.MENTION_REPLY_MSG || 'Oui, tu m\'as mentionné ?' }]),
            mentions: [m.sender],
        });
    } catch (e) {}
});
