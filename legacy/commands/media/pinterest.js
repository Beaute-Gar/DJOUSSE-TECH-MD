const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'pinterest',
    react: '📌',
    desc: 'Télécharger une image/vidéo Pinterest',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const url = dl.pickUrl(m, []);
    if (!url) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .pinterest <url Pinterest>' }]));
    if (!/pinterest\./.test(url)) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Ce lien n\'est pas Pinterest.' }]));

    try {
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const res = await dl.downloadPinterest(url);
        if (!res || !res.ok) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec du téléchargement: ' + (res?.error || 'Erreur inconnue') }]));
        if (!res.buffer) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Buffer média vide.' }]));

        const caption = box('PINTEREST', ['📌 Pinterest', res.title ? '📌 ' + res.title : '', '© DJOUSSE TECH']);
        const isImage = res.type === 'image' || /\.(jpg|jpeg|png|webp)/i.test(url);
        await conn.sendMessage(m.chat, { [isImage ? 'image' : 'video']: res.buffer, caption }, { quoted: m });
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (error) {
        console.error('PINTEREST ERROR:', error);
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur: ' + error.message }]));
    }
});
