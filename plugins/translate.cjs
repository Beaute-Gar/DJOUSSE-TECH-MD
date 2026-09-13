const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');

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

cmd({
  pattern: 'tr',
  alias: ['translate', 'traduire', 'trad'],
  desc: 'Traduire un texte dans une langue cible',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply('Usage: .tr <texte>\nOu: .tr en <texte>');

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
      const detected = await ainoria.detectLanguage(text);
      const autoTarget = detected === 'fr' ? 'en' : 'fr';
      const translated = await ainoria.translate(text, autoTarget, { sourceLang: detected });
      const flag = LANG_FLAGS[autoTarget] || '🌐';
      return reply(`${flag} *TRADUCTION* (${LANG_MAP[detected] || detected} → ${LANG_MAP[autoTarget]})\n\n${translated}`);
    }

    const translated = await ainoria.translate(text, targetLang);
    const flag = LANG_FLAGS[targetLang] || '🌐';
    return reply(`${flag} *TRADUCTION → ${LANG_MAP[targetLang]}*\n\n${translated}`);
  } catch (e) {
    return reply('Erreur: ' + e.message);
  }
});

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
