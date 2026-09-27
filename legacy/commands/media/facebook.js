const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'fb',
    react: '📱',
    desc: 'Télécharger une vidéo Facebook',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const url = dl.pickUrl(m, []);
    if (!url) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .fb <url Facebook>' }]));
    if (!/(facebook\.com|fb\.watch|fb\.com)/.test(url)) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Ce lien n\'est pas Facebook.' }]));

    try {
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const res = await dl.downloadFacebook(url);
        if (!res || !res.ok) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec du téléchargement: ' + (res?.error || 'Erreur inconnue') }]));
        if (!res.buffer) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Buffer vidéo vide.' }]));

        const caption = box('FACEBOOK', ['📱 Facebook', res.title ? '📌 ' + res.title : '', '© DJOUSSE TECH']);
        await conn.sendMessage(m.chat, { video: res.buffer, caption }, { quoted: m });
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (error) {
        console.error('FB ERROR:', error);
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur: ' + error.message }]));
    }
});
