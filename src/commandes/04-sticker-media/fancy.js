'use strict';

const style = require('../../config/style');

const FANCY_MAP = {
    bold: text => text.split('').map(character => {
        const code = character.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1D3BF);
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1D3B9);
        if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1D7CE);
        return character;
    }).join(''),
    italic: text => text.split('').map(character => {
        const code = character.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1D3F3);
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1D3ED);
        return character;
    }).join(''),
    script: text => text.split('').map(character => {
        const map = {
            a: '𝒶', b: '𝒷', c: '𝒸', d: '𝒹', e: '𝑒', f: '𝒻', g: '𝑔', h: '𝒽', i: '𝒾',
            j: '𝒿', k: '𝓀', l: '𝓁', m: '𝓂', n: '𝓃', o: '𝑜', p: '𝓅', q: '𝓆', r: '𝓇',
            s: '𝓈', t: '𝓉', u: '𝓊', v: '𝓋', w: '𝓌', x: '𝓍', y: '𝓎', z: '𝓏',
        };
        return map[character.toLowerCase()] || character;
    }).join(''),
    bubble: text => text.split('').map(character => {
        const map = {
            a: 'ⓐ', b: 'ⓑ', c: 'ⓒ', d: 'ⓓ', e: 'ⓔ', f: 'ⓕ', g: 'ⓖ', h: 'ⓗ', i: 'ⓘ',
            j: 'ⓙ', k: 'ⓚ', l: 'ⓛ', m: 'ⓜ', n: 'ⓝ', o: 'ⓞ', p: 'ⓟ', q: 'ⓠ', r: 'ⓡ',
            s: 'ⓢ', t: 'ⓣ', u: 'ⓤ', v: 'ⓥ', w: 'ⓦ', x: 'ⓧ', y: 'ⓨ', z: 'ⓩ',
            A: 'Ⓐ', B: 'Ⓑ', C: 'Ⓒ', D: 'Ⓓ', E: 'Ⓔ', F: 'Ⓕ', G: 'Ⓖ', H: 'Ⓗ', I: 'Ⓘ',
            J: 'Ⓙ', K: 'Ⓚ', L: 'Ⓛ', M: 'Ⓜ', N: 'Ⓝ', O: 'Ⓞ', P: 'Ⓟ', Q: 'Ⓠ', R: 'Ⓡ',
            S: 'Ⓢ', T: 'Ⓣ', U: 'Ⓤ', V: 'Ⓥ', W: 'Ⓦ', X: 'Ⓧ', Y: 'Ⓨ', Z: 'Ⓩ',
        };
        return map[character] || character;
    }).join(''),
    square: text => text.split('').map(character => {
        const map = {
            a: '🄰', b: '🄱', c: '🄲', d: '🄳', e: '🄴', f: '🄵', g: '🄶', h: '🄷', i: '🄸',
            j: '🄹', k: '🄺', l: '🄻', m: '🄼', n: '🄽', o: '🄾', p: '🄿', q: '🅀', r: '🅁',
            s: '🅂', t: '🅃', u: '🅄', v: '🅅', w: '🅆', x: '🅇', y: '🅈', z: '🅉',
        };
        return map[character.toLowerCase()] || character;
    }).join(''),
    vaporwave: text => text.split('').map(character => {
        const code = character.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCodePoint(code + 0xFEE0);
        return character;
    }).join(''),
};

module.exports = {
    commands: ['fancy'],
    description: 'Render text in decorative Unicode styles',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ').trim();
        const reply = value => ctx.reply(style.renderOutgoingText(value));

        if (!text) return reply('❌ *Usage:* `.fancy <text>`\n\nStyles: bold, italic, script, bubble, square, vaporwave');

        const parts = text.split('|');
        const selectedStyle = parts.length > 1 ? parts[0].trim().toLowerCase() : 'all';
        const input = parts.length > 1 ? parts.slice(1).join('|').trim() : text;

        if (selectedStyle === 'all') {
            const results = Object.entries(FANCY_MAP)
                .map(([name, transform]) => `*${name}:* ${transform(input)}`)
                .join('\n');
            return reply(`✨ *Fancy Text: "${input}"*\n\n${results}`);
        }

        const transform = FANCY_MAP[selectedStyle];
        if (!transform) {
            return reply(`❌ Unknown style. Choose from: ${Object.keys(FANCY_MAP).join(', ')}`);
        }
        return reply(`✨ *${selectedStyle}:* ${transform(input)}`);
    },
};
