const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fs = require('fs');
const path = require('path');

const LANG_FILE = path.join(__dirname, '..', 'data', 'group-lang.json');

function loadLangs() {
  try {
    fs.mkdirSync(path.dirname(LANG_FILE), { recursive: true });
    return JSON.parse(fs.readFileSync(LANG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveLangs(data) {
  fs.mkdirSync(path.dirname(LANG_FILE), { recursive: true });
  fs.writeFileSync(LANG_FILE, JSON.stringify(data, null, 2));
}

const LANGUAGES = {
  fr: { name: 'Français', flag: '🇫🇷', greeting: 'Bonjour', farewell: 'Au revoir' },
  en: { name: 'English', flag: '🇬🇧', greeting: 'Hello', farewell: 'Goodbye' },
  es: { name: 'Español', flag: '🇪🇸', greeting: 'Hola', farewell: 'Adiós' },
  de: { name: 'Deutsch', flag: '🇩🇪', greeting: 'Hallo', farewell: 'Auf Wiedersehen' },
  pt: { name: 'Português', flag: '🇧🇷', greeting: 'Olá', farewell: 'Adeus' },
  it: { name: 'Italiano', flag: '🇮🇹', greeting: 'Ciao', farewell: 'Arrivederci' },
  ar: { name: 'العربية', flag: '🇸🇦', greeting: 'مرحبا', farewell: 'وداعا' },
  ha: { name: 'Hausa', flag: '🇳🇬', greeting: 'Sannu', farewell: 'Sai wano' },
  yo: { name: 'Yorùbá', flag: '🇳🇬', greeting: 'Bawo', farewell: 'O dabọ' },
  ig: { name: 'Igbo', flag: '🇳🇬', greeting: 'Ndewo', farewell: 'Ka ọ dị' },
};

cmd({
  pattern: 'lang',
  alias: ['language', 'langue'],
  desc: 'Changer la langue du bot pour ce groupe',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  const langs = loadLangs();

  if (!q) {
    const current = langs[m.chat] || 'fr';
    const langList = Object.entries(LANGUAGES).map(([code, l]) => {
      const check = code === current ? ' ← actuelle' : '';
      return `${l.flag} *${code}* — ${l.name}${check}`;
    }).join('\n');
    return reply(box('🌍 *LANGUES DISPONIBLES*', [
      { raw: langList },
      { blank: true },
      { label: 'Usage', value: '.lang <code>' },
    ]));
  }

  const code = q.trim().toLowerCase();
  if (!LANGUAGES[code]) {
    return reply('❌ Langue non supportée. Codes: ' + Object.keys(LANGUAGES).join(', '));
  }

  langs[m.chat] = code;
  saveLangs(langs);

  const l = LANGUAGES[code];
  await m.react(l.flag);
  return reply(`${l.flag} Langue du bot changée en *${l.name}* !\n${l.greeting} !`);
});

cmd({
  pattern: 'greet',
  alias: ['salut', 'hello'],
  desc: 'Saluer dans la langue du groupe',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const langs = loadLangs();
  const code = langs[m.chat] || 'fr';
  const l = LANGUAGES[code] || LANGUAGES.fr;
  return reply(`${l.flag} ${l.greeting} ! Comment puis-je t'aider ?`);
});

cmd({
  pattern: 'langlist',
  alias: ['languages', 'langues'],
  desc: 'Liste des langues disponibles',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const langs = loadLangs();
  const current = langs[m.chat] || 'fr';
  const lines = Object.entries(LANGUAGES).map(([code, l]) => {
    const check = code === current ? ' ← active' : '';
    return `${l.flag} *${code}* — ${l.name}${check}`;
  }).join('\n');
  return reply(box('🌍 *LANGUES*', [{ raw: lines }]));
});
