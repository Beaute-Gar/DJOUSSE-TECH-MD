'use strict';

const style = require('../../config/style');
const FACTS = Object.freeze([
  'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.',
  'The Great Wall of China is not visible from space without aid.',
  "Vikings didn't actually wear horned helmets.",
  'Oxford University is older than the Aztec Empire.',
  'The shortest war lasted 38 to 45 minutes.',
  'Ancient Romans used urine to whiten their teeth.',
  'Napoleon was actually average height for his time.',
  'The pyramids were originally white and shiny.',
  'Albert Einstein was offered presidency of Israel.',
  'Coca-Cola was originally green.',
  'The first computer programmer was a woman — Ada Lovelace.',
  'Genghis Khan created one of the first international postal systems.',
  'Ancient Egyptians used moldy bread as medicine.',
  "The Titanic's pool is still filled with water.",
  'The last execution by guillotine was in 1977.',
]);

module.exports = {
  commands: ['historyfact', 'historyf'],
  description: 'Random history fact',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['History Fact', '', `📜 ${fact}`]));
  },
};
