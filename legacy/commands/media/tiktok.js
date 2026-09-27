const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'tt',
    react: '🎵',
    desc: 'Télécharger une vidéo TikTok',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const url = dl.pickUrl(m, []);
    if (!url) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .tt <url TikTok>' }]));
    if (!/tiktok\.com/.test(url)) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Ce lien n\'est pas TikTok.' }]));

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

    const res = await dl.downloadTiktok(url);
    if (!res.ok) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec du téléchargement TikTok.' }]));

    const caption = box('TIKTOK', ['⬇️ TikTok', res.title ? '📌 ' + res.title : '', '© DJOUSSE TECH']);

    try {
        await conn.sendMessage(m.chat, { video: res.buffer, caption }, { quoted: m });
    } catch (e) {
        try {
            await conn.sendMessage(m.chat, { image: res.buffer, caption }, { quoted: m });
        } catch (e2) {
            m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec envoi du média.' }]));
        }
    }

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
});
