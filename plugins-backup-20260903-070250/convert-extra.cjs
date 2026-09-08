const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const { mp3ToVoiceNote } = require('../lib/voice.cjs');

cmd({ pattern: 'translate', desc: 'Traduire un texte', category: 'convert', filename: __filename }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const lang = /^[a-z]{2}(-[a-z]{2})?$/i.test(args[0] || '') ? args.shift().toLowerCase() : 'fr';
  let text = args.join(' ');
  if (!text && m.quoted) text = m.quoted.msg?.text || '';
  if (!text) return m.reply(box('🌐 *TRADUCTION*', [
    { raw: 'Utilisation :' },
    { raw: '.translate <langue> <texte>' },
    { blank: true },
    { raw: 'Exemple :' },
    { raw: '.translate en Bonjour le monde' },
  ]));
  try {
    const res = await fetchJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`);
    const result = res?.[0]?.map(r => r?.[0]).filter(Boolean).join('') || 'Aucun résultat';
    m.reply(box('🌐 *TRADUCTION*', [
      { label: 'Langue', value: `*auto → ${lang}*` },
      { label: 'Original', value: `_${truncate(text, 80)}_` },
      { blank: true },
      { raw: `*${truncate(result, 300)}*` },
    ]));
  } catch (e) {
    m.reply(box('🌐 *TRADUCTION*', [
      { label: 'Erreur', value: e.message },
    ]));
  }
});

cmd({ pattern: 'voice', desc: 'Convertir du texte en voix', category: 'convert', filename: __filename }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply('❌ Usage: .voice <texte>');
  const audio = await getBuffer(`https://api.ryzendesu.vip/api/ai/tts?q=${encodeURIComponent(text)}`);
  if (!audio) return m.reply('❌ Impossible de générer la voix.');
  const vn = mp3ToVoiceNote(audio);
  await conn.sendMessage(m.chat, vn
    ? { audio: vn.audio, mimetype: vn.mimetype, ptt: true, seconds: vn.seconds }
    : { audio, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
});
