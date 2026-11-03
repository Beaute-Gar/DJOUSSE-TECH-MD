// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":17,"entryOrder":440}
'use strict';

const style = require('../../config/style');

const BIOS = Object.freeze([
  "Just a vibe you can't find anywhere else 🌊",
  'Making history, not repeating it 📜',
  'Turning dreams into plans 🎯',
  'Built different 🏗️',
  'Creating my own sunshine ☀️',
  'Less talk, more action 🎬',
  'Leveling up daily 📈',
  'Not lucky, just blessed 🙏',
  'Born to stand out 🌟',
  "Life's too short for bad vibes 🦋",
  'Main character energy ✨',
  'Plot twist expert 🎭',
  'Living the dream... mostly 😴',
  'Under construction 🚧',
  'Collecting moments, not things 📸',
]);

module.exports = {
  commands: ['bio2', 'bioideas'],
  description: 'Random bio ideas',
  permission: 'public',
  run: async (_sock, _message, _args, ctx) => {
    const ideas = Array.from(
      { length: 5 },
      () => `• ${BIOS[Math.floor(Math.random() * BIOS.length)]}`,
    );
    return ctx.reply(style.renderInfo(['Bio Ideas', '', ...ideas]));
  },
};
