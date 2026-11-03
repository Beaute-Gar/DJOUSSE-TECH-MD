'use strict';

const style = require('../../config/style');
const MEMES = Object.freeze([
  '*Me:* I should sleep early tonight.\n*Also me at 3 AM:* 👀📱',
  '*My brain during exams:* 🎵 Song I heard 3 years ago 🎵',
  '*Nobody:*\n*Absolutely nobody:*\n*My stomach during a quiet meeting:* 🎺🎺🎺',
  "*Friend:* How are you?\n*Me:* I'm fine 🙂\n*My search history:* Why do I exist",
  '*Teacher:* The test will be easy.\n*The test:* If a train leaves at 3am going 60mph and the sun is purple, calculate the meaning of life.',
  '*Monday:* Exists\n*My motivation:* Aight, imma head out 🚶',
  "*Me:* I'll start my diet tomorrow.\n*Tomorrow me:* 🍕🍔🌮🍩",
  "*Brain:* Don't say anything weird.\n*Me:* 🤡\n*Brain:* ...",
  "*5-year-old me:* I can't wait to grow up!\n*Grown-up me:* This is not what I signed up for. 😐",
  '*WiFi:* Disconnects for 0.001 seconds\n*Online class:* 💀',
]);

module.exports = {
  commands: ['meme', 'memequote'],
  description: 'Meme text',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const meme = MEMES[Math.floor(Math.random() * MEMES.length)];
    await ctx.reply(style.renderInfo(['Meme', '', `😂 ${meme}`]));
  },
};
