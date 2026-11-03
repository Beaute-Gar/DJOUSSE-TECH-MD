'use strict';

const style = require('../../config/style');
const LINES = Object.freeze([
  'Are you a magician? Because whenever I look at you, everyone else disappears. ✨',
  'Do you have a map? Because I just got lost in your eyes. 🗺️',
  "Is your name Google? Because you have everything I've been searching for. 🔍",
  "Are you a parking ticket? Because you've got 'fine' written all over you. 😏",
  'Do you believe in love at first sight, or should I walk by again? 💕',
  "If beauty were time, you'd be an eternity. ⏳",
  "Are you a campfire? Because you're hot and I want s'more. 🔥",
  "Is your dad a boxer? Because you're a knockout! 🥊",
  'Do you have a Band-Aid? Because I just scraped my knee falling for you. 🩹',
  "Are you made of copper and tellurium? Because you're Cu-Te. 🧪",
  "I'm not a photographer, but I can picture us together. 📸",
  'Your hand looks heavy — let me hold it for you. 🤝',
  'If you were a vegetable, you’d be a cute-cumber. 🥒',
  'Are you a time traveler? Because I see you in my future. ⏰',
  "I must be a snowflake, because I've fallen for you. ❄️",
]);

module.exports = {
  commands: ['pickup', 'rizz'],
  description: 'Random pickup line',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    await ctx.reply(style.renderInfo(['Pickup Line', '', `💘 ${line}`]));
  },
};
