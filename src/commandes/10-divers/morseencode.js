// @legacy-order {"sourceFile":"10-divers/morse.js","sourceOrder":145,"definitionIndex":0,"entryOrder":442}
'use strict';

const style = require('../../config/style');

const ENCODE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..',
  j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.',
  s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--',
  '?': '..--..', '!': '-.-.--', ' ': '/',
};
const DECODE = Object.fromEntries(Object.entries(ENCODE).map(([key, value]) => [value, key]));

module.exports = {
  commands: ['morseencode', 'morsedecode'],
  description: 'Encode or decode Morse code',
  usage: '.morseencode encode Hello | .morsedecode decode .... . .-.. .-.. ---',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const mode = (args[0] || '').toLowerCase();
    if (!['encode', 'decode', 'enc', 'dec'].includes(mode) || args.length < 2) {
      return ctx.reply(style.renderError([
        'Usage:',
        '.morseencode encode Hello World',
        '.morsedecode decode .... . .-.. .-.. ---',
      ]));
    }

    const input = args.slice(1).join(' ');
    const isEncode = mode === 'encode' || mode === 'enc';
    const result = isEncode
      ? input.toLowerCase().split('').map((char) => ENCODE[char] || '').filter(Boolean).join(' ')
      : input.split(' ').map((code) => DECODE[code] || '?').join('');

    return ctx.reply(style.renderInfo(isEncode
      ? ['Morse Encoder', '', `Text: ${input}`, '', `Morse: ${result}`]
      : ['Morse Decoder', '', `Morse: ${input}`, '', `Text: ${result.toUpperCase()}`]));
  },
};
