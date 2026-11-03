'use strict';

const style = require('../../config/style');

const FIRST_NAMES = Object.freeze([
  'James', 'Mary', 'Ahmed', 'Fatima', 'Wei', 'Yuki', 'Carlos', 'Sofia',
  'Kwame', 'Amara',
]);
const LAST_NAMES = Object.freeze([
  'Smith', 'Johnson', 'Hassan', 'Ali', 'Wang', 'Tanaka', 'Garcia',
  'Fernandez', 'Mensah', 'Okafor',
]);
const JOBS = Object.freeze([
  'Software Engineer', 'Teacher', 'Designer', 'Accountant', 'Chef', 'Writer',
]);
const BLOOD_TYPES = Object.freeze(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']);
const COLORS = Object.freeze(['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Pink']);

function choose(values) {
  return values[Math.floor(Math.random() * values.length)];
}

module.exports = {
  commands: ['fakeid', 'identity'],
  description: 'Generate a fictional character profile',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const age = Math.floor(Math.random() * 50) + 18;
    await ctx.reply(style.renderInfo([
      'Fictional Character',
      '',
      `Name: ${choose(FIRST_NAMES)} ${choose(LAST_NAMES)}`,
      `Age: ${age}`,
      `Occupation: ${choose(JOBS)}`,
      `Blood Type: ${choose(BLOOD_TYPES)}`,
      `Favorite Color: ${choose(COLORS)}`,
      '',
      'Fictional example; not a real identity.',
    ]));
  },
};
