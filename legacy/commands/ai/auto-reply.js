const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');

cmd({
    pattern: 'autoreply|autoanswer',
    desc: 'Toggle réponse automatique',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isOwner) return m.reply(boxWithFooter('ERROR', [{ raw: '❌ Owner only' }]));
    config.AUTO_REPLY = !config.AUTO_REPLY;
    m.reply(boxWithFooter('AUTO-REPLY', [{ raw: `✅ Auto-reply: ${config.AUTO_REPLY ? 'activé' : 'désactivé'}` }]));
});

cmd({
    filter: (m) => {
        if (!config.AUTO_REPLY) return false;
        if (!m.message) return false;
        if (m.fromMe) return false;
        if (m.isGroup) return false;
        return true;
    },
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!body) return;
        await ctx.conn.sendMessage(m.sender, {
            text: boxWithFooter('AUTO-REPLY', [{ raw: config.AUTO_REPLY_MSG || 'Je suis occupé, je te répondrai plus tard.' }]),
        });
    } catch (e) {}
});
