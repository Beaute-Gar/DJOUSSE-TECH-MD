const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const yts = require('yt-search');

cmd({
    pattern: 'video',
    alias: ['ytvideo', 'ytv'],
    desc: 'Download YouTube Video',
    category: 'download',
    react: '🎬',
    filename: __filename
}, async (conn, m, commands, { from, q, args, reply }) => {
    try {
        const query = (q || args?.join(' ') || '').trim();
        if (!query) return reply(box('VIDEO', ['EXAMPLE: .video Pasoori']));

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let youtubeUrl;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            youtubeUrl = query;
        } else {
            const search = await yts(query);
            if (!search?.videos?.length) {
                await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
                return reply(box('VIDEO', ['NO VIDEO FOUND.']));
            }
            youtubeUrl = search.videos[0].url;
        }

        const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await axios.get(apiUrl, { timeout: 60000 });

        if (!res.data?.status || !res.data?.result?.download?.url) {
            await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
            return reply('❌ VIDEO API ERROR.');
        }

        const videoUrl = res.data.result.download.url;
        const title = res.data.result.metadata?.title || 'YouTube Video';

        let videoTitle = title;
        try {
            const searchInfo = await yts(youtubeUrl);
            if (searchInfo?.videos?.length) videoTitle = searchInfo.videos[0].title;
        } catch (_) {}

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: box('VIDEO', [
                `TITLE: ${videoTitle}`,
                'SENDING VIDEO...'
            ]),
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: NEWSLETTER_JID,
                    newsletterName: config.BOT_NAME || 'DJOUSSE TECH',
                    serverMessageId: 3
                }
            }
        }, { quoted: m });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (err) {
        console.error('VIDEO ERROR:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        return reply('❌ VIDEO ERROR.');
    }
});

const NEWSLETTER_JID = '120363413253579833@newsletter';
