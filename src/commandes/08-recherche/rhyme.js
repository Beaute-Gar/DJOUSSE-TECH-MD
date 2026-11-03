'use strict';

const style = require('../../config/style');

const RHYMES = {
  cat: ['bat', 'hat', 'mat', 'sat', 'rat', 'flat', 'chat'],
  day: ['way', 'say', 'play', 'stay', 'may', 'pay', 'bay'],
  light: ['night', 'right', 'sight', 'fight', 'might', 'bright', 'tight'],
  love: ['above', 'dove', 'glove', 'shove'],
  blue: ['true', 'new', 'few', 'view', 'due', 'grew', 'knew'],
  time: ['rhyme', 'climb', 'dime', 'lime', 'prime', 'mime'],
  rain: ['main', 'pain', 'gain', 'train', 'brain', 'chain', 'plain'],
  star: ['far', 'car', 'bar', 'jar', 'guitar', 'scar'],
  feel: ['real', 'deal', 'heal', 'steal', 'wheel', 'meal'],
  mind: ['find', 'kind', 'blind', 'behind', 'remind', 'wind'],
};

module.exports = {
  commands: ['rhyme', 'rhymes'],
  description: 'Find rhyming words',
  usage: '.rhyme <word>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const word = String(args[0] || '').toLowerCase();
    if (!word) return ctx.reply(style.renderError(['Usage : .rhyme <word>']));
    const rhymes = RHYMES[word] || Object.values(RHYMES).find((group) => group.includes(word));
    if (!rhymes) {
      return ctx.reply(style.renderError(['No rhymes found. Try: cat, day, light, love, blue, time, rain, star, feel, mind']));
    }
    return ctx.reply(style.renderInfo([
      `Rhymes for "${word}"`,
      '',
      rhymes.filter((item) => item !== word).join(', '),
    ]));
  },
};
