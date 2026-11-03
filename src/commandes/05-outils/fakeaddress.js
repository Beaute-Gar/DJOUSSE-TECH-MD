'use strict';

const style = require('../../config/style');

const STREETS = Object.freeze([
  'Example Street', 'Sample Avenue', 'Fictional Road', 'Demo Lane',
]);

module.exports = {
  commands: ['fakeaddress', 'address'],
  description: 'Generate a fictional sample address',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    await ctx.reply(style.renderInfo([
      'Random Address',
      '',
      `${number} ${street}`,
      'Sample City',
      '00000',
      '',
      'Fictional example',
    ]));
  },
};
