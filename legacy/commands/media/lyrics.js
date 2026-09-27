const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'lyrics',
    react: '🎵',
    desc: 'Rechercher les paroles d\'une chanson',
    category: 'download',
    filename: __filename
}, async (conn, m) => {
    const query = (m.body || '').split(' ').slice(1).join(' ').trim();
    if (!query) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Usage: .lyrics <nom chanson>' }]));

    try {
        await conn.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

        let lyricsData = null;

        // API 1: lrclib (fiable)
        try {
            const { data } = await axios.get(`https://lrclib.net/api/search?track_name=${encodeURIComponent(query)}`, { timeout: 15000, headers: { 'User-Agent': 'DJOUSSE-TECH-MD/1.0' } });
            if (data?.length > 0) {
                const song = data[0];
                lyricsData = { title: song.trackName, artist: song.artistName, lyrics: song.syncedLyrics || song.plainLyrics || '', thumbnail: null };
            }
        } catch (e) { }

        // API 2: Vreden (fallback)
        if (!lyricsData) {
            try {
                const { data } = await axios.get(`https://api.vreden.my.id/api/lyrics?query=${encodeURIComponent(query)}`, { timeout: 10000 });
                if (data?.result) {
                    lyricsData = { title: data.result.title, artist: data.result.artist, lyrics: data.result.lyrics, thumbnail: data.result.thumbnail };
                }
            } catch (e) { }
        }

        if (!lyricsData) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Paroles introuvables pour cette chanson.' }]));

        let lyrics = lyricsData.lyrics;
        if (lyrics.length > 4000) lyrics = lyrics.substring(0, 4000) + '...\n\n_Paroles tronquées_';

        const caption = box('PAROLES', [`🎵 ${lyricsData.title}`, `👤 Artiste: ${lyricsData.artist}`, '', '📝 Paroles:', lyrics, '', '© DJOUSSE TECH']);

        if (lyricsData.thumbnail) {
            await conn.sendMessage(m.chat, { image: { url: lyricsData.thumbnail }, caption }, { quoted: m });
        } else {
            await m.reply(caption);
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (error) {
        console.error('LYRICS ERROR:', error);
        return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur lors de la recherche des paroles.' }]));
    }
});
