'use strict';

const style = require('../../config/style');
const JOKES = Object.freeze([
  'My wife told me to stop impersonating a flamingo. I had to put my foot down. 🦩',
  'I told my wife she was drawing her eyebrows too high. She looked surprised. 😮',
  "I have a joke about construction, but I'm still working on it. 🏗️",
  "I asked my date to meet me at the gym but she never showed up. I guess the two of us aren't working out. 💪",
  'I told my computer I needed a break. Now it won’t stop sending me vacation ads. 💻',
  "Why did the old man fall in the well? Because he couldn't see that well. 👴",
  'My boss told me to have a good day. So I went home. 🏠',
]);

module.exports = {
  commands: ['darkjoke', 'dark'],
  description: 'Dark humor joke',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    await ctx.reply(style.renderInfo(['Dark Humor', '', `🖤 ${joke}`]));
  },
};
