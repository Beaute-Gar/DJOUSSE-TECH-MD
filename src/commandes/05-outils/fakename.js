'use strict';

const style = require('../../config/style');

const FIRST_NAMES = Object.freeze([
  'James', 'Mary', 'John', 'Emma', 'David', 'Sarah', 'Michael', 'Emily',
  'Daniel', 'Olivia', 'William', 'Sophia', 'Benjamin', 'Isabella', 'Amara',
  'Kwame', 'Aisha', 'Fatima', 'Zara', 'Kofi',
]);
const LAST_NAMES = Object.freeze([
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Garcia',
  'Martinez', 'Robinson', 'Clark', 'Mwangi', 'Ochieng', 'Akinyi', 'Okafor',
  'Ibrahim', 'Mensah',
]);

module.exports = {
  commands: ['fakename', 'name'],
  description: 'Generate a fictional name',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    await ctx.reply(style.renderInfo(['Random Name', '', `${first} ${last}`, '', 'Fictional example']));
  },
};
