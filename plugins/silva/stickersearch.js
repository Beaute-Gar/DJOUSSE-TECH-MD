'use strict';
const axios = require('axios');

module.exports = {
    commands:    ['stickersearch', 'findsticker', 'giphy'],
    description: 'Search and send animated stickers/GIFs',
    permission:  'public',
    group:       true,
    private:     true,
    run: async (sock, message, args, { sender, groupId, contextInfo }) => {
        const chatId = groupId || sender;
        const query  = args.join(' ');
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '🔍 Usage: .stickersearch <query>\nExample: .stickersearch laughing cat',
                contextInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `⏳ Searching GIFs for "${query}"...`, contextInfo }, { quoted: message });
        try {
            const apiKey = (process.env.TENOR_API_KEY || '').trim();
            if (!apiKey) {
                return sock.sendMessage(chatId, {
                    text: '🔑 Clé Tenor manquante : ajoute TENOR_API_KEY dans le .env (l’API Tenor de Google est fermée, le service est indisponible sans clé valide).',
                    contextInfo
                }, { quoted: message });
            }
            const api = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1&media_filter=gif`;
            const { data } = await axios.get(api, { timeout: 10000 });
            const gif = data?.results?.[0]?.media_formats?.gif?.url;
            if (!gif) throw new Error('No GIFs found.');
            const { data: gifData } = await axios.get(gif, { responseType: 'arraybuffer', timeout: 20000 });
            await sock.sendMessage(chatId, {
                video:     Buffer.from(gifData),
                gifPlayback: true,
                mimetype:  'video/mp4',
                caption:   `🎭 *${query}* — Silva MD`,
                contextInfo
            }, { quoted: message });
        } catch (e) {
            if (e.response?.status === 403 || /discontinu/i.test(e.message)) {
                await sock.sendMessage(chatId, { text: '❌ Service GIF indisponible : l\'API Tenor a été arrêtée par Google.', contextInfo }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: `❌ Sticker search failed: ${e.message}`, contextInfo }, { quoted: message });
            }
        }
    }
};
