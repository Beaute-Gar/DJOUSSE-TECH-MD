'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['couple', 'love'],
  description: 'Calculate love compatibility between two people',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    let [first, second] = args.join(' ').split(/\s+and\s+|\s*,\s*|\s+&\s+/i);
    first = first?.trim();
    second = second?.trim();

    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length >= 2) {
      first = `@${mentions[0].split('@')[0]}`;
      second = `@${mentions[1].split('@')[0]}`;
    } else if (!first || !second) {
      return ctx.reply(style.renderError([
        'Usage',
        '',
        '.ship <name1> and <name2>',
        'Or mention two people: .ship @person1 @person2',
      ]));
    }

    const seed = (first + second).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const percentage = seed % 101;
    const bar = '💗'.repeat(Math.floor(percentage / 10)) + '🖤'.repeat(10 - Math.floor(percentage / 10));
    const verdict = percentage >= 80
      ? '💍 Perfect match! Get married already!'
      : percentage >= 60
        ? '💕 Great chemistry!'
        : percentage >= 40
          ? '😊 Pretty good!'
          : percentage >= 20
            ? '🤔 Could work with effort.'
            : '💔 Not a great match.';

    await ctx.reply(style.renderInfo([
      'Ship Results',
      '',
      `👫 ${first} + ${second}`,
      '',
      bar,
      `❤️ ${percentage}% Compatible`,
      '',
      verdict,
    ]), mentions);
  },
};
