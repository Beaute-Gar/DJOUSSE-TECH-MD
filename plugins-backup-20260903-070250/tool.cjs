const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const axios = require('axios');
const { box, truncate } = require('../lib/djousse-ui.cjs');

// ─────────────────────────── QR CODE ───────────────────────────
cmd({ pattern: 'qrcode', react: '🔗', desc: 'Generate QR code from text or URL', category: 'MATHTOOL', use: '.qrcode <text or URL>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🔗 *QR CODE*', [
        { label: 'Utilisation', value: '.qrcode <text or URL>' },
        { label: 'Exemple', value: '.qrcode https://example.com' },
    ]));
    const file = path.join(os.tmpdir(), 'qrcode-' + Date.now() + '.png');
    try {
        await QRCode.toFile(file, q.trim(), { type: 'png', margin: 2, scale: 8 });
        const img = fs.readFileSync(file);
        await conn.sendMessage(from, { image: img, caption: box('🔗 *QR CODE*', [
            { label: '📝 Data', value: truncate(q.trim(), 60) },
        ]) }, { quoted: m });
    } catch (e) {
        console.error('QR Code error:', e.message, e.stack);
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to generate QR code.' },
        ]));
    } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
});

// ─────────────────────────── SHORT URL ───────────────────────────
cmd({ pattern: 'shorturl', react: '✂️', desc: 'Shorten a long URL', category: 'MATHTOOL', use: '.shorturl <long-url>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('✂️ *URL SHORTENER*', [
        { label: 'Utilisation', value: '.shorturl <long-url>' },
        { label: 'Exemple', value: '.shorturl https://example.com' },
    ]));
    let url = q.trim();
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    try {
        const res = await axios.get('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url));
        const short = res.data;
        await conn.sendMessage(from, { text: box('✂️ *URL SHORTENER*', [
            { label: '🔗 Original', value: truncate(url, 40) },
            { label: '✨ Short', value: truncate(short, 40) },
        ]) }, { quoted: m });
    } catch (e) {
        console.error('URL Shortener error:', e.message, e.stack);
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to shorten URL.' },
        ]));
    }
});

// ─────────────────────────── BASE64 ENCODE ───────────────────────────
cmd({ pattern: 'b64encode', react: '🔒', desc: 'Encode text to Base64', category: 'MATHTOOL', use: '.b64encode <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🔒 *BASE64 ENCODE*', [
        { label: 'Utilisation', value: '.b64encode <text>' },
        { label: 'Exemple', value: '.b64encode Bonjour' },
    ]));
    try {
        const encoded = Buffer.from(q.trim()).toString('base64');
        await conn.sendMessage(from, { text: box('🔒 *BASE64 ENCODE*', [
            { label: 'Original', value: truncate(q.trim(), 60) },
            { label: 'Encoded', value: truncate(encoded, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to encode text.' },
        ]));
    }
});

// ─────────────────────────── BASE64 DECODE ───────────────────────────
cmd({ pattern: 'b64decode', react: '🔓', desc: 'Decode Base64 text', category: 'MATHTOOL', use: '.b64decode <base64>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🔓 *BASE64 DECODE*', [
        { label: 'Utilisation', value: '.b64decode <base64>' },
        { label: 'Exemple', value: '.b64decode Qm9uam91cg==' },
    ]));
    try {
        const decoded = Buffer.from(q.trim(), 'base64').toString('utf-8');
        await conn.sendMessage(from, { text: box('🔓 *BASE64 DECODE*', [
            { label: 'Base64', value: truncate(q.trim(), 60) },
            { label: 'Decoded', value: truncate(decoded, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to decode Base64.' },
        ]));
    }
});

// ─────────────────────────── JSON FORMATTER ───────────────────────────
cmd({ pattern: 'jsonfmt', react: '📝', desc: 'Format JSON text', category: 'MATHTOOL', use: '.jsonfmt <json>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('📝 *JSON FORMATTER*', [
        { label: 'Utilisation', value: '.jsonfmt <json>' },
        { label: 'Exemple', value: '.jsonfmt {"nom":"Djousse"}' },
    ]));
    try {
        const parsed = JSON.parse(q.trim());
        const formatted = JSON.stringify(parsed, null, 2);
        await conn.sendMessage(from, { text: box('📝 *JSON FORMATTER*', [
            { raw: truncate(formatted, 400) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Invalid JSON.' },
        ]));
    }
});

// ─────────────────────────── WI-FI QR CODE ───────────────────────────
cmd({ pattern: 'wifi', react: '📶', desc: 'Generate Wi-Fi QR code', category: 'djousse', use: '.wifi <SSID>|<PASSWORD>|<WPA|nopass>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('📶 *WI-FI QR CODE*', [
        { label: 'Utilisation', value: '.wifi <SSID>|<PASSWORD>|<WPA|nopass>' },
        { label: 'Exemple', value: '.wifi MySSID|MyPass|WPA' },
    ]));
    const parts = q.split('|');
    if (parts.length < 3) return reply(box('📶 *WI-FI QR CODE*', [
        { label: 'Erreur', value: 'Incorrect format.' },
    ]));
    const [ssid, password, security] = parts.map(p => p.trim());
    const file = path.join(os.tmpdir(), 'wifi-' + Date.now() + '.png');
    const data = 'WIFI:T:' + security + ';S:' + ssid + ';P:' + password + ';;';
    try {
        await QRCode.toFile(file, data, { type: 'png', margin: 2, scale: 8 });
        const img = fs.readFileSync(file);
        await conn.sendMessage(from, { image: img, caption: box('📶 *WI-FI QR CODE*', [
            { label: 'SSID', value: truncate(ssid, 30) },
            { label: 'Security', value: security },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to generate Wi-Fi QR code.' },
        ]));
    } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
});

// ─────────────────────────── TEXT → BINARY ───────────────────────────
cmd({ pattern: 'txt2bin', react: '💻', desc: 'Convert text to binary', category: 'MATHTOOL', use: '.txt2bin <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('💻 *TEXT → BINARY*', [
        { label: 'Utilisation', value: '.txt2bin <text>' },
        { label: 'Exemple', value: '.txt2bin Hello' },
    ]));
    try {
        const binary = q.trim().split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        await conn.sendMessage(from, { text: box('💻 *TEXT → BINARY*', [
            { label: 'Text', value: truncate(q.trim(), 60) },
            { label: 'Binary', value: truncate(binary, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to convert text to binary.' },
        ]));
    }
});

// ─────────────────────────── BINARY → TEXT ───────────────────────────
cmd({ pattern: 'bin2txt', react: '💻', desc: 'Convert binary to text', category: 'MATHTOOL', use: '.bin2txt <binary>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('💻 *BINARY → TEXT*', [
        { label: 'Utilisation', value: '.bin2txt <binary>' },
        { label: 'Exemple', value: '.bin2txt 01001000 01100101' },
    ]));
    try {
        const text = q.trim().split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
        await conn.sendMessage(from, { text: box('💻 *BINARY → TEXT*', [
            { label: 'Binary', value: truncate(q.trim(), 60) },
            { label: 'Text', value: truncate(text, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to convert binary.' },
        ]));
    }
});

// ─────────────────────────── REVERSE TEXT ───────────────────────────
cmd({ pattern: 'reverse', react: '🔄', desc: 'Reverse text', category: 'MATHTOOL', use: '.reverse <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🔄 *REVERSE TEXT*', [
        { label: 'Utilisation', value: '.reverse <text>' },
        { label: 'Exemple', value: '.reverse Hello' },
    ]));
    try {
        const reversed = q.trim().split('').reverse().join('');
        await conn.sendMessage(from, { text: box('🔄 *REVERSE TEXT*', [
            { label: 'Original', value: truncate(q.trim(), 60) },
            { label: 'Reversed', value: truncate(reversed, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to reverse text.' },
        ]));
    }
});

// ─────────────────────────── MORSE MAP ───────────────────────────
const morseMap = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
    'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
    'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    ' ': '/', '!': '-.-.--', '?': '..--..', ',': '--..--', '.': '.-.-.-', '-': '-....-'
};

// ─────────────────────────── TEXT → MORSE ───────────────────────────
cmd({ pattern: 'morse', react: '📡', desc: 'Text to Morse code', category: 'MATHTOOL', use: '.morse <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('📡 *MORSE ENCODE*', [
        { label: 'Utilisation', value: '.morse <text>' },
        { label: 'Exemple', value: '.morse HELLO' },
    ]));
    try {
        const morse = q.trim().toUpperCase().split('').map(c => morseMap[c] || '?').join(' ');
        await conn.sendMessage(from, { text: box('📡 *MORSE ENCODE*', [
            { label: 'Text', value: truncate(q.trim(), 60) },
            { label: 'Morse', value: truncate(morse, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to convert to Morse code.' },
        ]));
    }
});

// ─────────────────────────── MORSE → TEXT ───────────────────────────
cmd({ pattern: 'demorse', react: '📡', desc: 'Morse code to text', category: 'MATHTOOL', use: '.demorse <morse>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('📡 *MORSE DECODE*', [
        { label: 'Utilisation', value: '.demorse <morse>' },
        { label: 'Exemple', value: '.demorse .... . .-.. .-.. ---' },
    ]));
    try {
        const reverseMap = Object.fromEntries(Object.entries(morseMap).map(([k, v]) => [v, k]));
        const text = q.trim().split(' ').map(morse => reverseMap[morse] || '?').join('');
        await conn.sendMessage(from, { text: box('📡 *MORSE DECODE*', [
            { label: 'Morse', value: truncate(q.trim(), 60) },
            { label: 'Text', value: truncate(text, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to decode Morse code.' },
        ]));
    }
});

// ─────────────────────────── HEX ENCODE ───────────────────────────
cmd({ pattern: 'hexencode', react: '🧩', desc: 'Encode text to HEX', category: 'MATHTOOL', use: '.hexencode <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🧩 *HEX ENCODE*', [
        { label: 'Utilisation', value: '.hexencode <text>' },
        { label: 'Exemple', value: '.hexencode Bonjour' },
    ]));
    try {
        const hex = Buffer.from(q.trim()).toString('hex');
        await conn.sendMessage(from, { text: box('🧩 *HEX ENCODE*', [
            { label: 'Text', value: truncate(q.trim(), 60) },
            { label: 'HEX', value: truncate(hex, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to HEX encode.' },
        ]));
    }
});

// ─────────────────────────── HEX DECODE ───────────────────────────
cmd({ pattern: 'hexdecode', react: '🧩', desc: 'Decode HEX to text', category: 'MATHTOOL', use: '.hexdecode <hex>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🧩 *HEX DECODE*', [
        { label: 'Utilisation', value: '.hexdecode <hex>' },
        { label: 'Exemple', value: '.hexdecode 426f6e6a6f7572' },
    ]));
    try {
        const text = Buffer.from(q.trim(), 'hex').toString('utf-8');
        await conn.sendMessage(from, { text: box('🧩 *HEX DECODE*', [
            { label: 'HEX', value: truncate(q.trim(), 60) },
            { label: 'Text', value: truncate(text, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to HEX decode.' },
        ]));
    }
});

// ─────────────────────────── URL ENCODE ───────────────────────────
cmd({ pattern: 'urlencode', react: '🌐', desc: 'URL encode text', category: 'MATHTOOL', use: '.urlencode <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🌐 *URL ENCODE*', [
        { label: 'Utilisation', value: '.urlencode <text>' },
        { label: 'Exemple', value: '.urlencode bonjour le monde' },
    ]));
    try {
        const encoded = encodeURIComponent(q.trim());
        await conn.sendMessage(from, { text: box('🌐 *URL ENCODE*', [
            { label: 'Text', value: truncate(q.trim(), 60) },
            { label: 'Encoded', value: truncate(encoded, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to URL encode.' },
        ]));
    }
});

// ─────────────────────────── URL DECODE ───────────────────────────
cmd({ pattern: 'urldecode', react: '🌐', desc: 'URL decode text', category: 'MATHTOOL', use: '.urldecode <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🌐 *URL DECODE*', [
        { label: 'Utilisation', value: '.urldecode <text>' },
        { label: 'Exemple', value: '.urldecode bonjour%20le%20monde' },
    ]));
    try {
        const decoded = decodeURIComponent(q.trim());
        await conn.sendMessage(from, { text: box('🌐 *URL DECODE*', [
            { label: 'Encoded', value: truncate(q.trim(), 60) },
            { label: 'Decoded', value: truncate(decoded, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to URL decode.' },
        ]));
    }
});

// ─────────────────────────── ROT13 CIPHER ───────────────────────────
cmd({ pattern: 'rot13', react: '🌀', desc: 'ROT13 cipher encode/decode', category: 'MATHTOOL', use: '.rot13 <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('🌀 *ROT13 CIPHER*', [
        { label: 'Utilisation', value: '.rot13 <text>' },
        { label: 'Exemple', value: '.rot13 Bonjour' },
    ]));
    try {
        const output = q.trim().replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)));
        await conn.sendMessage(from, { text: box('🌀 *ROT13 CIPHER*', [
            { label: 'Input', value: truncate(q.trim(), 60) },
            { label: 'Output', value: truncate(output, 60) },
        ]) }, { quoted: m });
    } catch (e) {
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Failed to apply ROT13.' },
        ]));
    }
});

// ─────────────────────────── PASSWORD GENERATOR ───────────────────────────
cmd({ pattern: 'passgen', react: '🔑', desc: 'Generate a random password', category: 'MATHTOOL', use: '.passgen <length>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?';
    const length = parseInt(q) || 12;
    let password = '';
    for (let i = 0; i < length; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    await conn.sendMessage(from, { text: box('🔑 *RANDOM PASSWORD*', [
        { label: 'Length', value: String(length) },
        { label: 'Password', value: password },
    ]) }, { quoted: m });
});

// ─────────────────────────── LOREM IPSUM ───────────────────────────
cmd({ pattern: 'lorem', react: '📄', desc: 'Generate Lorem Ipsum placeholder text', category: 'MATHTOOL', use: '.lorem <number of words>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
    const count = parseInt(q) || 100;
    let text = '';
    for (let i = 0; i < count; i++) text += words[Math.floor(Math.random() * words.length)] + ' ';
    await conn.sendMessage(from, { text: box('📄 *LOREM IPSUM*', [
        { raw: truncate(text.trim(), 800) },
    ]) }, { quoted: m });
});

// ─────────────────────────── RANDOM COLOR ───────────────────────────
cmd({ pattern: 'color', react: '🎨', desc: 'Generate a random hex color', category: 'MATHTOOL', use: '.color', filename: __filename }, async (conn, m, commands, { from }) => {
    const color = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    await conn.sendMessage(from, { text: box('🎨 *RANDOM COLOR*', [
        { label: 'Hex', value: color },
    ]) }, { quoted: m });
});

// ─────────────────────────── EMOJI STYLE ───────────────────────────
cmd({ pattern: 'emoji', react: '😎', desc: 'Convert text to emoji style', category: 'MATHTOOL', use: '.emoji <text>', filename: __filename }, async (conn, m, commands, { from, q, reply }) => {
    if (!q) return reply(box('😎 *EMOJI STYLE*', [
        { label: 'Utilisation', value: '.emoji <text>' },
        { label: 'Exemple', value: '.emoji Hello' },
    ]));
    const result = q.trim().split('').map(c => c.match(/[a-zA-Z0-9]/) ? ':' + c.toLowerCase() + ':' : c).join(' ');
    await conn.sendMessage(from, { text: box('😎 *EMOJI STYLE*', [
        { raw: truncate(result, 300) },
    ]) }, { quoted: m });
});
