const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'ig',
    react: '📸',
    desc: 'Télécharger un post/reel Instagram',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const url = dl.pickUrl(m, []);
    if (!url) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .ig <url Instagram>' }]));
    if (!/instagram\.com|instagr\.am/.test(url)) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Ce n\'est pas un lien Instagram.' }]));

    try {
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const res = await dl.downloadInstagram(url);
        if (!res || !res.ok) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ ' + (res?.error || 'Post privé ou lien invalide.') }]));
        if (!res.buffer) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Média vide.' }]));

        const caption = box('INSTAGRAM', ['📸 Instagram', '© DJOUSSE TECH']);
        const mediaType = res.type === 'video' ? 'video' : 'image';
        await conn.sendMessage(m.chat, { [mediaType]: res.buffer, caption }, { quoted: m });
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (error) {
        console.error('IG ERROR:', error);
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur: ' + error.message }]));
    }
});
