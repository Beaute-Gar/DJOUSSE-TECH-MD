'use strict';

const style = require('../../config/style');

const DARES = [
  'Send a voice note singing your favorite song',
  'Send a selfie right now',
  'Change your profile picture for 1 hour',
  'Text your crush "I miss you"',
  'Do 20 push-ups and send proof',
  'Speak in an accent for the next 10 messages',
  'Post an embarrassing photo on your status',
  'Call the 3rd person in your contacts',
  'Eat something spicy and record it',
  'Dance and send a video',
  'Let someone post on your status',
  'Send "I love you" to a random contact',
  'Make a funny face and send a photo',
  'Talk to a stranger and screenshot it',
  'Write a poem about the person who dared you',
];

module.exports = {
  commands: ['dare', 'dareq'],
  description: 'Dare challenge',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const dare = DARES[Math.floor(Math.random() * DARES.length)];
    await ctx.reply(style.renderInfo(['Dare', '', dare]));
  },
};
