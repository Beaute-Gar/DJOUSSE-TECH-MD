const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const { mp3ToVoiceNote } = require('../lib/voice.cjs');

cmd({
  pattern: 'tts',
  alias: ['say', 'speak', 'parler'],
  react: '🗣️',
  desc: 'Convertir un texte en voix (français)',
  category: 'convert',
  filename: __filename
}, async (conn, m) => {
  const text = (m.body.split(' ').slice(1).join(' ') || (m.quoted ? (m.quoted.msg?.text || m.quoted.text || '') : '')).trim();
  if (!text) return m.reply(box('🔊 *TEXT-TO-SPEECH*', [
    { raw: 'Utilisation :' },
    { raw: '.tts <texte>' },
    { blank: true },
    { raw: 'Exemple :' },
    { raw: '.tts Bonjour tout le monde' },
  ]));
  if (text.length > 200) return m.reply('❌ Texte trop long (max 200 caractères).');
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=fr&client=tw-ob`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36' },
      timeout: 30000
    });
    const caption = box('🔊 *TEXT-TO-SPEECH*', [
      { label: 'Texte', value: `_${truncate(text, 80)}_` },
      { label: 'Langue', value: '*fr*' },
    ]);
    const mp3 = Buffer.from(res.data);
    const vn = mp3ToVoiceNote(mp3);
    await conn.sendMessage(m.chat, vn
      ? { audio: vn.audio, mimetype: vn.mimetype, ptt: true, seconds: vn.seconds, caption }
      : { audio: mp3, mimetype: 'audio/mpeg', ptt: false, caption }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur TTS: ' + e.message);
  }
});
