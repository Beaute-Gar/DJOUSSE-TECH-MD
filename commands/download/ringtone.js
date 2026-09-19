const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

/* .ringtone <query> — Recherche et envoie un ringtone aléatoire */
cmd({
    pattern: 'ringtone',
    alias: ['ringtones', 'ring'],
    react: '🎵',
    desc: 'Recherche un ringtone (ex: .ringtone iphone)',
    category: 'download',
    filename: __filename,
}, async (conn, m, commands, { reply, q }) => {
    if (!q) {
        return reply(boxWithFooter('RINGTONE', [
            { raw: '❌ Tapez un nom pour rechercher.' },
            { raw: 'Exemple: .ringtone iphone' },
        ]));
    }
    try {
        const res = await axios.get(`https://www.dark-yasiya-api.site/download/ringtone?text=${encodeURIComponent(q.trim())}`);
        const data = res.data;
        const results = data.result || data.data || data.results || [];

        if (!results.length) {
            return reply(boxWithFooter('RINGTONE', [
                { raw: `❌ Aucun ringtone trouvé pour "${q.trim()}".` },
            ]));
        }

        const random = results[Math.floor(Math.random() * results.length)];
        const audioUrl = random.url || random.audio || random.link;
        const title = random.title || random.name || q.trim();

        if (!audioUrl) {
            return reply(boxWithFooter('RINGTONE', [
                { raw: '❌ Impossible de récupérer l\'audio.' },
            ]));
        }

        await conn.sendMessage(m.chat, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            ptt: false,
        }, { quoted: m });

        await reply(boxWithFooter('RINGTONE', [
            { label: '🎵 Titre', value: title },
        ]));
    } catch (err) {
        console.error('Ringtone Error:', err.message);
        await reply(boxWithFooter('RINGTONE', [
            { raw: '❌ Erreur lors de la recherche du ringtone.' },
        ]));
    }
});
