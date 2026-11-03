// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":11,"entryOrder":161}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['emoji2', 'emojimeaning'],
  description: 'Emoji meaning',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const meanings = {
      '😂': 'Face with Tears of Joy',
      '❤️': 'Red Heart',
      '🥰': 'Smiling Face with Hearts',
      '😎': 'Smiling Face with Sunglasses',
      '🤔': 'Thinking Face',
      '🥳': 'Partying Face',
      '😱': 'Face Screaming in Fear',
      '🤯': 'Exploding Head',
      '👻': 'Ghost',
      '💀': 'Skull',
      '🤖': 'Robot',
      '👽': 'Alien',
      '🦄': 'Unicorn',
      '🔥': 'Fire',
      '⭐': 'Star',
      '💫': 'Dizzy',
      '🎉': 'Party Popper',
      '💎': 'Gem Stone',
      '💰': 'Money Bag',
      '🚀': 'Rocket',
    };
    const emoji = args[0];
    if (!emoji) {
      return ctx.reply(style.renderError(['Usage: .emoji2 <emoji>']));
    }

    return ctx.reply(style.renderInfo([
      `📚 *Emoji Meaning*\n\n${emoji} = ${meanings[emoji] || 'Unknown emoji'}`,
    ]));
  },
};
