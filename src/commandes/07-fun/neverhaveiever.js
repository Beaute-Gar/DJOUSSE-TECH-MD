'use strict';

const style = require('../../config/style');

const PROMPTS = [
  'Never have I ever lied to get out of plans',
  'Never have I ever eaten food off the floor',
  'Never have I ever pretended to text to avoid talking',
  'Never have I ever stayed up all night',
  'Never have I ever broken a bone',
  'Never have I ever been in a food fight',
  'Never have I ever skipped school',
  'Never have I ever been on TV',
  'Never have I ever cried at a movie',
  'Never have I ever talked to myself',
  'Never have I ever laughed so hard I cried',
  'Never have I ever forgotten my own birthday',
  'Never have I ever been stung by a bee',
  'Never have I ever gone skinny dipping',
  'Never have I ever re-gifted a present',
];

module.exports = {
  commands: ['neverhaveiever', 'nhie'],
  description: 'Never Have I Ever',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    await ctx.reply(style.renderInfo([
      'Never Have I Ever',
      '',
      prompt,
      '',
      "React 👍 if you have, 👎 if you haven't!",
    ]));
  },
};
