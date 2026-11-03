'use strict';

const style = require('../../config/style');

const POWERS = Object.freeze([
  'Telekinesis — move objects with your mind 🧠',
  'Time travel — journey through time ⏰',
  'Invisibility — become unseen 👻',
  'Super speed — move at lightning pace ⚡',
  'Flight — soar through the skies 🦅',
  'Telepathy — read minds 🔮',
  'Shape-shifting — transform into anything 🦎',
  'Healing — recover from injuries 💚',
  'Elemental control — command fire, water, earth, and air 🌊',
  'Super strength — lift anything 💪',
  'Teleportation — instantly travel anywhere 🌀',
  'Precognition — see the future 🔮',
  'Elasticity — stretch your body 🤸',
  'Magnetism — control metal 🧲',
  'X-ray vision — see through objects 👁️',
]);

module.exports = {
  commands: ['superpower', 'randompower'],
  description: 'Generate a random fictional superpower',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const power = POWERS[Math.floor(Math.random() * POWERS.length)];
    await ctx.reply(style.renderInfo(['Your Superpower', '', power]));
  },
};
