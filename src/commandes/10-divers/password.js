// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":12,"entryOrder":144}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['password2', 'genpass'],
  description: 'Advanced password generator',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const requestedLength = parseInt(args[0], 10);
    const length = Math.min(requestedLength || 16, 128);
    const type = (args[1] || 'mixed').toLowerCase();
    let characters;

    if (type === 'numbers' || type === 'num') {
      characters = '0123456789';
    } else if (type === 'alpha') {
      characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    } else if (type === 'hex') {
      characters = '0123456789ABCDEF';
    } else {
      characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    }

    let password = '';
    for (let index = 0; index < length; index++) {
      password += characters[Math.floor(Math.random() * characters.length)];
    }

    const strength = Math.min(Math.floor(length / 4), 5);
    return ctx.reply(style.renderInfo([
      '🔐 Password',
      '',
      `Length: ${length}`,
      `Type: ${type}`,
      '',
      `\`${password}\``,
      '',
      `Strength: ${'🟩'.repeat(strength)}${'⬜'.repeat(5 - strength)}`,
    ]));
  },
};
