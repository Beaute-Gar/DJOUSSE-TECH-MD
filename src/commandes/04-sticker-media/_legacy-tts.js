'use strict';
const axios = require('axios');
const config = require('../../config/config');

const VOICES = { en:'en',fr:'fr',sw:'sw',ar:'ar',es:'es',de:'de',ja:'ja',zh:'zh-CN',hi:'hi',pt:'pt' };

module.exports = {
    commands:    ['tts', 'speak', 'voice'],
    description: 'Convert text to speech audio',
    usage:       '.tts <text>  or  .tts <lang> <text>',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { contextInfo } = ctx;
        const jid = message.key.remoteJid;
        if (!args.length) {
            return sock.sendMessage(jid, {
                text: `❌ *Usage:* \`.tts <text>\` or \`.tts <lang> <text>\`\n_Languages:_ en, fr, sw, ar, es, de, ja, zh, hi, pt`,
                contextInfo
            }, { quoted: message });
        }
        let lang = 'en', text;
        if (VOICES[args[0].toLowerCase()]) { lang = VOICES[args[0].toLowerCase()]; text = args.slice(1).join(' '); }
        else { text = args.join(' '); }
        if (!text?.trim()) return sock.sendMessage(jid, { text: `❌ Please provide text.`, contextInfo }, { quoted: message });
        if (text.length > 200) return sock.sendMessage(jid, { text: `❌ Max 200 characters.`, contextInfo }, { quoted: message });
        try {
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
            const res    = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            await sock.sendMessage(jid, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: true }, { quoted: message });
        } catch (err) {
            // Réessayez avec ElevenLabs si la clé est configurée
            if (config.elevenlabsKey) {
                try {
                    const voiceId = 'pNInz6obviR9B1vJ5wsF'; // voix par défaut gratuite
                    const ElevenLabsUrl = `https://api.elevenlabs.io/v1/text-with-speech/${voiceId}?output_format=mp3`;
                    const res = await axios.post(ElevenLabsUrl,
                        { text: text },
                        { headers: { 'xi-api-key': config.elevenlabsKey, 'Content-Type': 'application/json' }, timeout: 15000 }
                    );
                    await sock.sendMessage(jid, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: true }, { quoted: message });
                } catch (err2) {
                    await sock.sendMessage(jid, { text: `❌ TTS failed`, contextInfo }, { quoted: message });
                }
            } else {
                await sock.sendMessage(jid, { text: `❌ TTS failed: ${err.message}`, contextInfo }, { quoted: message });
            }
        }
    }
};
