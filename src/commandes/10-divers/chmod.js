'use strict';
// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":14,"entryOrder":146}

const style = require('../../config/style');

module.exports = {
  commands: ['chmod', 'permissions'],
  description: 'Unix permissions calculator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const input = args[0] || '';
    const number = Number.parseInt(input, 10);
    if (!/^[0-7]{1,3}$/.test(input) || Number.isNaN(number) || number > 777) {
      return ctx.reply(style.renderError([
        'Usage: .chmod <number>',
        'Example: .chmod 755',
      ]));
    }

    const permissions = input.padStart(3, '0').split('').map((digit) => {
      const value = Number.parseInt(digit, 10);
      return `${value & 4 ? 'r' : '-'}${value & 2 ? 'w' : '-'}${value & 1 ? 'x' : '-'}`;
    });
    return ctx.reply(style.renderInfo([
      `📁 *Permissions: ${input}*`,
      '',
      `Owner: ${permissions[0]}`,
      `Group: ${permissions[1]}`,
      `Other: ${permissions[2]}`,
      '',
      `Full: ${permissions.join('')}`,
    ]));
  },
};
