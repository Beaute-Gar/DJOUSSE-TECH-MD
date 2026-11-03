'use strict';

const style = require('../../config/style');

const WORDS = Object.freeze([
  'cool', 'super', 'mega', 'ultra', 'fast', 'smart', 'tech', 'code',
  'dev', 'pixel', 'data', 'cloud',
]);

module.exports = {
  commands: ['fakeemail', 'email'],
  description: 'Generate a fictional example email address',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const first = WORDS[Math.floor(Math.random() * WORDS.length)];
    const second = WORDS[Math.floor(Math.random() * WORDS.length)];
    const number = Math.floor(Math.random() * 1000);
    await ctx.reply(style.renderInfo([
      'Random Email',
      '',
      `${first}${second}${number}@example.com`,
      '',
      'Fictional example',
    ]));
  },
};
