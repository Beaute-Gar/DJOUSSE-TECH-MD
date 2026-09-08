const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

const LANG_MAP = {
  fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', pt: 'Português',
  it: 'Italiano', nl: 'Nederlands', ru: 'Русский', ja: '日本語', ko: '한국어',
  zh: '中文', ar: 'العربية', hi: 'हिन्दी', tr: 'Türkçe', pl: 'Polski',
  vi: 'Tiếng Việt', th: 'ไทย', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu',
  sw: 'Kiswahili', ha: 'Hausa', yo: 'Yorùbá', ig: 'Igbo'
};

const LANG_FLAGS = {
  fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', de: '🇩🇪', pt: '🇧🇷', it: '🇮🇹',
  nl: '🇳🇱', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦',
  hi: '🇮🇳', tr: '🇹🇷', pl: '🇵🇱', vi: '🇻🇳', th: '🇹🇭', id: '🇮🇩',
  sw: '🇰🇪', ha: '🇳🇬', yo: '🇳🇬', ig: '🇳🇬'
};

async function detectLanguage(text) {
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'Detect the language of the text. Reply ONLY with the ISO 639-1 code (fr, en, es, de, pt, it, etc). Nothing else.' },
        { role: 'user', content: text }
      ],
      max_completion_tokens: 10,
      temperature: 0
    }, {
      headers: { 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || ''), 'Content-Type': 'application/json' },
      timeout: 10000
    });
    const lang = res.data.choices[0].message.content.trim().toLowerCase().slice(0, 2);
    return LANG_MAP[lang] ? lang : 'en';
  } catch {
    return 'en';
  }
}

async function translateText(text, targetLang, sourceLang) {
  const langName = LANG_MAP[targetLang] || targetLang;
  const srcLabel = sourceLang ? ` from ${LANG_MAP[sourceLang] || sourceLang}` : '';
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: `You are a professional translator. Translate the following text to ${langName}${srcLabel}. Reply ONLY with the translation, nothing else. Keep the same tone and meaning. If the text is already in ${langName}, reply with the original text.` },
        { role: 'user', content: text }
      ],
      max_completion_tokens: 2048,
      temperature: 0.3
    }, {
      headers: { 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || ''), 'Content-Type': 'application/json' },
      timeout: 20000
    });
    return res.data.choices[0].message.content.trim();
  } catch (e) {
    throw new Error('Traduction impossible: ' + (e.response?.data?.error?.message || e.message));
  }
}

cmd({
  pattern: 'tr',
  alias: ['translate', 'traduire', 'trad'],
  desc: 'Traduire un texte dans une langue cible',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(box('🌐 *TRADUCTION AUTO*', [
      { label: 'Usage', value: '.tr <texte>' },
      { label: 'Avec langue', value: '.tr en <texte>' },
      { label: 'Exemple', value: '.tr es Bonjour le monde' },
      { blank: true },
      { raw: 'Langues supportées: fr, en, es, de, pt, it, nl, ru, ja, ko, zh, ar, hi, tr, pl, vi, th, id, sw, ha, yo, ig' },
    ]));
  }

  const parts = q.trim().split(/\s+/);
  let targetLang = null;
  let text = q;

  if (parts.length > 1 && LANG_MAP[parts[0].toLowerCase()]) {
    targetLang = parts[0].toLowerCase();
    text = parts.slice(1).join(' ');
  }

  try {
    await m.react('🌐');
    if (!targetLang) {
      const detected = await detectLanguage(text);
      const autoTarget = detected === 'fr' ? 'en' : 'fr';
      const translated = await translateText(text, autoTarget, detected);
      const flag = LANG_FLAGS[autoTarget] || '🌐';
      return reply(box(`${flag} *TRADUCTION* (${LANG_MAP[detected] || detected} → ${LANG_MAP[autoTarget]})`, [
        { label: 'Original', value: truncate(text, 100) },
        { blank: true },
        { raw: translated },
      ]));
    }
    const translated = await translateText(text, targetLang);
    const flag = LANG_FLAGS[targetLang] || '🌐';
    return reply(box(`${flag} *TRADUCTION → ${LANG_MAP[targetLang]}`, [
      { label: 'Original', value: truncate(text, 100) },
      { blank: true },
      { raw: translated },
    ]));
  } catch (e) {
    return reply('❌ ' + e.message);
  }
});

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
