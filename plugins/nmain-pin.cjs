const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

cmd({
    pattern: 'pinterestdl',
    alias: ['pinterest', 'pin', 'pins', 'pindownload'],
    react: '📌',
    desc: 'Télécharger un média Pinterest',
    category: 'download',
    filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
    if (!q || !q.startsWith('http')) {
        return reply(box('📌 *PINTEREST DL*', [
            { raw: 'Utilisation :' },
            { raw: '.pinterestdl <url pinterest>' },
            { blank: true },
            { raw: 'Exemple :' },
            { raw: '.pinterestdl https://www.pinterest.com/pin/123456789/' },
        ]));
    }

    try {
        await m.react('⏳').catch(() => {});

        const apiUrl = 'https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=' + encodeURIComponent(q);
        const { data } = await axios.get(apiUrl, { timeout: 15000 });

        if (!data.success || !data.result?.media || data.result.media.length === 0) {
            return reply('❌ Impossible de télécharger ce média Pinterest.');
        }

        const { title, description, media } = data.result;
        const video = media.find(item => item.type?.includes('720p'));
        const thumbnail = media.find(item => item.type === 'Thumbnail');
        const mediaType = video ? 'Vidéo' : 'Image';

        const caption = box('📌 *PINTEREST*', [
            { label: 'Titre', value: title || 'Inconnu' },
            { label: 'Type', value: mediaType },
            { label: 'Description', value: (description || 'Aucune').slice(0, 100) },
        ]);

        if (video) {
            await conn.sendMessage(m.chat, { video: { url: video.download_url }, caption }, { quoted: m });
        } else if (thumbnail) {
            await conn.sendMessage(m.chat, { image: { url: thumbnail.download_url }, caption }, { quoted: m });
        } else {
            return reply('❌ Aucun média trouvé.');
        }

        await m.react('✅').catch(() => {});
    } catch (err) {
        await m.react('❌').catch(() => {});
        reply('❌ Erreur: ' + err.message);
    }
});
