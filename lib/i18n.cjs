const fs = require('fs');
const path = require('path');

const LANG_DIR = path.join(__dirname, '..', 'data', 'languages');
const DEFAULT_LANG = 'en';

const languages = {};
try {
    languages[DEFAULT_LANG] = require(path.join(LANG_DIR, `${DEFAULT_LANG}.cjs`));
} catch (e) {
    console.error('❌ Failed to load English language file:', e.message);
    languages[DEFAULT_LANG] = {};
}

function t(chatJid, key, vars = {}) {
    const pack = languages[DEFAULT_LANG];
    let text = (pack && pack[key]) ?? key;
    for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
}

module.exports = { t, languages, DEFAULT_LANG };
