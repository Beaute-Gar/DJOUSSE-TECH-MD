'use strict';

const style = require('../../config/style');

const DREAMS = Object.freeze({
  flying: {
    meaning: 'Freedom, ambition, and a desire to escape limitations',
    tip: 'You may be feeling liberated or seeking independence.',
  },
  falling: {
    meaning: 'Anxiety, loss of control, or insecurity',
    tip: 'Consider what in your life feels unstable.',
  },
  water: {
    meaning: 'Emotions, the subconscious mind, and purification',
    tip: 'Clear water can suggest clarity; murky water can suggest confusion.',
  },
  teeth: {
    meaning: 'Anxiety about appearance or communication',
    tip: 'You may be worried about how others perceive you.',
  },
  chase: {
    meaning: 'Avoiding an issue or running from something',
    tip: 'Consider facing the problem you have been avoiding.',
  },
  snake: {
    meaning: 'Hidden fears, transformation, or healing',
    tip: 'A challenge may also be an opportunity for growth.',
  },
  death: {
    meaning: 'Endings, transformation, and new beginnings',
    tip: 'This is symbolic, not a prediction; it can represent change.',
  },
  baby: {
    meaning: 'New beginnings, innocence, or vulnerability',
    tip: 'A new project or phase may be starting.',
  },
  house: {
    meaning: 'The self and different aspects of life',
    tip: 'Consider which part of yourself the dream highlights.',
  },
  exam: {
    meaning: 'Self-evaluation or fear of failure',
    tip: 'You may feel tested in some area of life.',
  },
});

const SYMBOLS = Object.keys(DREAMS).join(', ');

module.exports = {
  commands: ['dreammeaning', 'dream'],
  description: 'Interpret a common dream symbol',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const symbol = String(args[0] || '').trim().toLowerCase();
    if (!symbol) {
      return ctx.reply(style.renderError([`Usage: .dream <symbol>`, `Symbols: ${SYMBOLS}`]));
    }

    const dream = DREAMS[symbol];
    if (!dream) {
      return ctx.reply(style.renderError([`Unknown dream symbol. Try: ${SYMBOLS}`]));
    }

    const title = symbol.charAt(0).toUpperCase() + symbol.slice(1);
    await ctx.reply(style.renderInfo([
      `Dream: ${title}`,
      '',
      `Meaning: ${dream.meaning}`,
      '',
      dream.tip,
    ]));
  },
};
