'use strict';

const style = require('../../config/style');
const EMOJIS = Object.freeze([
  '😀', '😂', '🥰', '😎', '🤔', '🥳', '😱', '🤯', '🥶', '🤠',
  '👻', '💀', '🤖', '👽', '🦄', '🌈', '🔥', '⭐', '💫', '🎉',
  '🎊', '🎭', '🎪', '🎨', '🎵', '🎸', '🎺', '🎯', '🏆', '💎',
  '💰', '🍕', '🍔', '🌮', '🍩', '🍦', '🎂', '🍷', '☕', '🚀',
  '✈️', '🏝️', '🌊', '🗻', '🌙', '☀️', '🌟', '🦋', '🐉', '🦁',
]);

module.exports = {
  commands: ['emoji', 'emojicombo'],
  description: 'Random emoji combination',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const count = Math.min(Number.parseInt(args[0], 10) || 5, 20);
    const combo = Array(count)
      .fill(0)
      .map(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    await ctx.reply(style.renderInfo(['Random Emoji Combo', '', combo.join(' ')]));
  },
};
