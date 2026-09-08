var commands = [];
var replyHandlers = [];
var fs = require('fs');
var _obfCache = {};

/* Normalisation centrale des commandes (patterns, aliases, catégories).
   Corrige les incohérences des plugins obfusqués sans les modifier. */
const CATEGORY_FIX = {
    /* Convert */
    'sticker': 'convert', 'toimg': 'convert', 'tomp3': 'convert', 'tovideo': 'convert',
    'togif': 'convert', 'toaudio': 'convert', 'convert': 'convert',
    /* Anime */
    'animegirl': 'anime', 'waifu': 'anime', 'anime': 'anime', 'animeboy': 'anime',
    'animefact': 'anime', 'animequiz': 'anime', 'animestyle': 'anime', 'aniroll': 'anime',
    'character': 'anime', 'hentai': 'anime', 'hentaigif': 'anime', 'husbando': 'anime',
    'kitsune': 'anime', 'neko': 'anime', 'nsfwai': 'anime', 'manga': 'anime',
    /* Fun */
    '8ball': 'fun', 'truth': 'fun', 'dare': 'fun', 'wyr': 'fun', 'roast': 'fun',
    'insult': 'fun', 'joke': 'fun', 'memes': 'fun', 'compliment': 'fun', 'pickup': 'fun',
    'fact': 'fun', 'rps': 'fun', 'ttt': 'fun', 'hangman': 'fun', 'trivia': 'fun',
    'quiz': 'fun', 'emojiquiz': 'fun', 'anigame': 'fun', 'quote': 'fun', 'fast': 'fun',
    'whoami': 'fun', 'imageurl': 'fun',
    /* Math */
    'calc': 'math',
    /* Outils */
    'qrcode': 'tools', 'shorturl': 'tools', 'b64encode': 'tools', 'b64decode': 'tools',
    'jsonfmt': 'tools', 'txt2bin': 'tools', 'bin2txt': 'tools', 'reverse': 'tools',
    'morse': 'tools', 'demorse': 'tools', 'hexencode': 'tools', 'hexdecode': 'tools',
    'urlencode': 'tools', 'urldecode': 'tools', 'rot13': 'tools', 'passgen': 'tools',
    'lorem': 'tools', 'color': 'tools', 'emoji': 'tools', 'collage': 'tools',
    'tourl': 'tools', 'ss': 'tools', 'define': 'tools',
};

function normalizeCategory(rawCat, pattern) {
    if (CATEGORY_FIX[pattern]) return CATEGORY_FIX[pattern];
    const cat = String(rawCat || 'misc').toLowerCase();
    if (cat === 'mathtool') return 'utility';
    if (cat === 'owner') return 'owner';
    return cat;
}

function cmd(info, func) {
    const data = info;
    data.function = func;
    if (!data.dontAddCommandList) data.dontAddCommandList = false;
    if (!data.desc) data.desc = '';
    if (!data.filename) data.filename = "Not Provided";
    if (!data.fromMe) data.fromMe = false;

    /* Patterns : minuscules + gestion des alias séparés par '|' */
    if (typeof data.pattern === 'string') {
        const parts = data.pattern.split('|').map(p => p.trim().toLowerCase()).filter(Boolean);
        data.pattern = parts[0] || data.pattern.toLowerCase();
        if (parts.length > 1) {
            data.alias = Array.isArray(data.alias)
                ? [...data.alias.map(a => String(a).toLowerCase()), ...parts.slice(1)]
                : parts.slice(1);
        }
    }
    if (Array.isArray(data.alias)) data.alias = data.alias.map(a => String(a).toLowerCase());

    if (!data.category) data.category = 'misc';
    data.category = normalizeCategory(data.category, typeof data.pattern === 'string' ? data.pattern : '');

    if (!data.pattern && typeof data.filter === "function") {
        replyHandlers.push(data);
    } else {
        /* Déduplication : en cas de doublon de pattern, on garde la version
           native (lisible) face à la version obfusquée, et la première
           enregistrée en cas d'égalité. Empêche les doubles réponses. */
        var dup = null;
        for (var i = 0; i < commands.length; i++) {
            if (String(commands[i].pattern || '').toLowerCase() === String(data.pattern || '').toLowerCase()) {
                dup = commands[i];
                break;
            }
        }
        if (dup && dup !== data) {
            if (_obfuscated(dup.filename) && !_obfuscated(data.filename)) {
                commands.splice(i, 1, data);
            }
        } else {
            commands.push(data);
        }
    }
    return data;
}

function _obfuscated(file) {
    var f = String(file);
    if (!f || f === 'Not Provided' || f === 'undefined') return true;
    if (_obfCache[f] !== undefined) return _obfCache[f];
    var val = true;
    try {
        var src = fs.readFileSync(f, 'utf8');
        var head = src.slice(0, 4000);
        val = !src || /(_0x[a-fA-F0-9]{4,})|(function\s+_0x)/.test(head);
    } catch (e) { val = true; }
    _obfCache[f] = val;
    return val;
}

module.exports = {
    cmd,
    AddCommand: cmd,
    Function: cmd,
    Module: cmd,
    commands,
    replyHandlers,
};
