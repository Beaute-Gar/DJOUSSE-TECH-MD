// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":7,"entryOrder":157}
'use strict';

const style = require('../../config/style');

const quotesByCategory = {
  success: [
    'Success is not the key to happiness. Happiness is the key to success. — Albert Schweitzer',
    'The secret of success is to do the common thing uncommonly well. — John D. Rockefeller',
  ],
  love: [
    'The best thing to hold onto in life is each other. — Audrey Hepburn',
    'Love is composed of a single soul inhabiting two bodies. — Aristotle',
  ],
  wisdom: [
    'The only true wisdom is in knowing you know nothing. — Socrates',
    'Knowing yourself is the beginning of all wisdom. — Aristotle',
  ],
  courage: [
    'Courage is not the absence of fear, but the triumph over it. — Nelson Mandela',
    "Life shrinks or expands in proportion to one's courage. — Anaïs Nin",
  ],
};

module.exports = {
  commands: ['quote2', 'dq'],
  description: 'Daily quote',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const category = (args[0] || '').toLowerCase();
    const pool = quotesByCategory[category] || Object.values(quotesByCategory).flat();
    const quote = pool[Math.floor(Math.random() * pool.length)];

    return ctx.reply(style.renderInfo([
      '💬 Daily Quote',
      quote,
      'Categories: success, love, wisdom, courage',
    ]));
  },
};
