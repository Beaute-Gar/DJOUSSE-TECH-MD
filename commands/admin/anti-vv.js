const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'anticiponce|antiVV',
    desc: 'Toggle anti-view-once (reenvoyer les messages view-once)',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isOwner) return m.reply(boxWithFooter('ERROR', [{ raw: '❌ Owner only' }]));
    const current = config.ANTI_VV;
    config.ANTI_VV = !current;
    m.reply(boxWithFooter('SUCCESS', [{ raw: `✅ Anti-view-once: ${config.ANTI_VV ? 'activé' : 'désactivé'}` }]));
});

cmd({
    filter: () => config.ANTI_VV,
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        if (!m || !m.message) return;
        const msg = m.message;
        const isViewOnce = msg.viewOnceMessage || msg.viewOnceMessageV2;
        if (!isViewOnce) return;

        const inner = isViewOnce.message;
        if (!inner) return;

        const type = Object.keys(inner)[0];
        if (!type) return;

        const mediaContent = inner[type];
        if (!mediaContent || !mediaContent.mimetype) return;

        const buffer = await ctx.conn.downloadMediaMessage({ key: m.key, message: inner });
        if (!buffer) return;

        const jid = m.isGroup ? m.chat : m.sender;
        const caption = mediaContent.caption || '';

        await ctx.conn.sendMessage(jid, {
            [type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : 'audio']: buffer,
            caption: boxWithFooter('VIEW-ONCE', [{ raw: `🔓 *View-Once intercepté*\n${caption}` }]),
        });
    } catch (e) {}
});
