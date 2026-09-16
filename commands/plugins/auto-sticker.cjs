const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { Sticker } = require('wa-sticker-formatter');

cmd({
    pattern: 'autosticker|autostk',
    desc: 'Toggle auto-sticker (les images envoyées deviennent des stickers)',
    category: 'owner',
    filename: __filename,
}, async (conn, m, commands, cfg) => {
    if (!m.isOwner) return m.reply('❌ Owner only');
    config.AUTO_STICKER = !config.AUTO_STICKER;
    m.reply(`✅ Auto-sticker: ${config.AUTO_STICKER ? 'activé' : 'désactivé'}`);
});

cmd({
    filter: (m) => {
        if (!config.AUTO_STICKER) return false;
        if (!m.message) return false;
        const msg = m.message;
        return !!(msg.imageMessage || msg.videoMessage);
    },
    dontAddCommandList: true,
    filename: __filename,
}, async (ctx) => {
    try {
        const m = ctx.m;
        const msg = m.message;
        const isImage = !!msg.imageMessage;
        const isVideo = !!msg.videoMessage;

        if (!isImage && !isVideo) return;
        if (msg.imageMessage && msg.imageMessage.caption) return;

        const buffer = await ctx.conn.downloadMediaMessage(m);
        if (!buffer) return;

        const sticker = new Sticker(buffer, {
            pack: config.STICKER_PACKNAME || config.STICKER_NAME,
            author: config.STICKER_AUTHOR || config.OWNER_NAME,
            type: isVideo ? 'full' : 'crop',
            quality: 70,
        });

        const stickerBuffer = await sticker.toBuffer();
        await ctx.conn.sendMessage(m.chat, { sticker: stickerBuffer });
    } catch (e) {}
});
