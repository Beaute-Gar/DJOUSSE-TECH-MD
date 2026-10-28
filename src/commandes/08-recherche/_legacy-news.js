'use strict';
const axios = require('axios');
const config = require('../../config/config');

const FEEDS = {
    world:    'https://feeds.bbci.co.uk/news/world/rss.xml',
    tech:     'https://feeds.bbci.co.uk/news/technology/rss.xml',
    africa:   'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    sports:   'https://feeds.bbci.co.uk/sport/rss.xml'
};

module.exports = {
    commands:    ['news', 'headlines'],
    description: 'Get latest news headlines',
    permission:  'public',
    group:       true,
    private:     true,
    run: async (sock, message, args, { sender, groupId, contextInfo }) => {
        const chatId   = groupId || sender;
        const category = (args[0] || 'world').toLowerCase();
        const feedUrl  = FEEDS[category] || FEEDS.world;
        try {
            const rssApi = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=5`;
            const { data } = await axios.get(rssApi, { timeout: 12000 });
            const items = data?.items;
            if (items?.length) {
                const lines = items.map((item, i) => `${i + 1}. *${item.title}*\n   🔗 ${item.link}`).join('\n\n');
                const cats  = Object.keys(FEEDS).join(' | ');
                await sock.sendMessage(chatId, {
                    text: `📰 *Latest News — ${category.toUpperCase()}*\n\n${lines}\n\n_Categories: ${cats}_\n_Powered by BBC • ${config.botName}_`,
                    contextInfo
                }, { quoted: message });
                return;
            }
        } catch (error) {
            console.warn('[NEWS] BBC feed failed; trying configured fallback.', error?.code || error?.name || 'unknown error');
        }
        if (config.gnewsKey) {
            try {
                const r = await axios.get(
                    `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=5&apikey=${config.gnewsKey}`,
                    { timeout: 15000 }
                );
                const j = r.data;
                const articles = j?.articles || [];
                if (articles.length) {
                    let text = `📰 *GNews : ${category.toUpperCase()}*\n\n`;
                    articles.slice(0, 5).forEach((a, i) => {
                        const t = a.title || '';
                        const src = a.source?.name || '';
                        const desc = a.description || '';
                        text += `*${i + 1}.* ${t.slice(0, 150)}`;
                        if (src) text += ` (${src})`;
                        text += `\n   🔗 ${a.url || ''}\n   ${desc?.slice(0, 200) || ''}\n\n`;
                    });
                    await sock.sendMessage(chatId, {
                        text: text,
                        contextInfo
                    }, { quoted: message });
                    return;
                }
            } catch (error) {
                console.warn('[NEWS] GNews fallback failed.', error?.code || error?.name || 'unknown error');
            }
        }
        return sock.sendMessage(chatId, {
            text: `❌ Impossible de récupérer les actualités ${category.toUpperCase()} pour le moment. Réessayez plus tard.`,
            contextInfo,
        }, { quoted: message });
        }
};
