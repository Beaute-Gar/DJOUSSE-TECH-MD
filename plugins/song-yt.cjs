const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const yts = require('yt-search');
const axios = require('axios');

const NEWSLETTER_JID = '120363413253579833@newsletter';
const NEWSLETTER_NAME = 'DJOUSSE TECH';

const TEXT = {
    noQuery: 'GIVE ME A SONG NAME OR LINK.',
    noResult: 'NO RESULT FOUND.',
    audioError: 'AUDIO COULD NOT BE GENERATED.',
    generalError: 'AN ERROR OCCURRED, TRY AGAIN LATER.',
    unknown: 'UNKNOWN TITLE',
};

cmd({
    pattern: 'song',
    alias: ['ytmp3', 'play', 'mp3', 'gana', 'music', 'audio'],
    react: '🎵',
    desc: 'YouTube search & MP3 download',
    category: 'download',
    use: '.song <name or link>',
    filename: __filename
}, async (conn, m, commands, { from, q, args, reply }) => {
    try {
        const query = (q || args?.join(' ') || '').trim();
        if (!query) return reply(box('SONG', [TEXT.noQuery]));

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const search = await yts(query);
        if (!search.videos || !search.videos.length) {
            return reply(box('SONG', [TEXT.noResult]));
        }

        const video = search.videos[0];
        const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(video.url)}`;

        const res = await axios.get(apiUrl, { timeout: 60000 });

        if (!res.data?.status || !res.data?.result?.download?.url) {
            return reply('❌ ' + TEXT.audioError);
        }

        const dlUrl = res.data.result.download.url;
        const meta = res.data.result.metadata || {};
        const title = meta.title || video.title || TEXT.unknown;

        await conn.sendMessage(from, {
            audio: { url: dlUrl },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${title.replace(/[\\/:*?"<>|]/g, '')}.mp3`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                externalAdReply: {
                    title: title.substring(0, 40),
                    body: '🎵 DJOUSSE TECH',
                    thumbnailUrl: video.thumbnail,
                    sourceUrl: video.url,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (err) {
        console.error('SONG ERROR:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        return reply('❌ ' + TEXT.generalError);
    }
});
