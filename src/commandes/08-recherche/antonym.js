'use strict';

const style = require('../../config/style');

const ANTONYMS = {
  happy: 'sad',
  big: 'small',
  fast: 'slow',
  good: 'bad',
  hot: 'cold',
  light: 'dark',
  up: 'down',
  old: 'young',
  rich: 'poor',
  strong: 'weak',
  love: 'hate',
  open: 'close',
  begin: 'end',
  win: 'lose',
  buy: 'sell',
  push: 'pull',
  true: 'false',
  hard: 'soft',
  wet: 'dry',
  loud: 'quiet',
  thick: 'thin',
  deep: 'shallow',
  wide: 'narrow',
  long: 'short',
  high: 'low',
  full: 'empty',
  clean: 'dirty',
  safe: 'dangerous',
  easy: 'difficult',
  early: 'late',
};

module.exports = {
  commands: ['antonym', 'ant'],
  description: 'Find antonyms',
  usage: '.antonym <word>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const word = String(args[0] || '').toLowerCase();
    if (!word) return ctx.reply(style.renderError(['Usage : .antonym <word>']));
    const opposite = ANTONYMS[word]
      || Object.entries(ANTONYMS).find(([, value]) => value === word)?.[0];
    if (!opposite) {
      return ctx.reply(style.renderError(['No antonym found. Try: happy, big, fast, good, hot, light, up, old, rich, strong']));
    }
    return ctx.reply(style.renderInfo([`Antonym of "${word}"`, '', `${word} ↔ ${opposite}`]));
  },
};
