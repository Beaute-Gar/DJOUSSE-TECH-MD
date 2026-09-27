const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');
const yts = require('yt-search');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'ytmp4',
    react: '🎬',
    desc: 'Télécharger une vidéo YouTube',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const url = dl.pickUrl(m, []);
    const query = url ? '' : (m.body || '').split(' ').slice(1).join(' ').trim();

    if (!url && !query) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .ytmp4 <nom ou url YouTube>' }]));

    try {
        await conn.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

        let videoUrl, title, thumbnail;

        if (url && /youtube\.com|youtu\.be/.test(url)) {
            videoUrl = url;
            title = 'YouTube';
        } else {
            const search = await yts(query || url);
            if (!search.videos?.length) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Vidéo introuvable.' }]));
            videoUrl = search.videos[0].url;
            title = search.videos[0].title;
            thumbnail = search.videos[0].thumbnail;
        }

        if (thumbnail) {
            await conn.sendMessage(m.chat, { image: { url: thumbnail }, caption: box('VIDEO', ['🎬 Téléchargement: ' + title]) }, { quoted: m });
        }

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const res = await dl.downloadYoutube(videoUrl, false);
        if (!res || !res.ok) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec du téléchargement: ' + (res?.error || 'Erreur inconnue') }]));
        if (!res.buffer) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Buffer vidéo vide.' }]));

        const caption = box('VIDEO', ['🎬 ' + (res.title || title), '© DJOUSSE TECH']);
        await conn.sendMessage(m.chat, { video: res.buffer, caption, mimetype: 'video/mp4' }, { quoted: m });
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (error) {
        console.error('YTMP4 ERROR:', error);
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur: ' + error.message }]));
    }
});
