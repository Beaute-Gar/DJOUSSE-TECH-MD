// @legacy-order {"sourceFile":"10-divers/password.js","sourceOrder":160,"definitionIndex":0,"entryOrder":521}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['passwd'],
  description: 'Generate a strong random password',
  usage: '.passwd [length]',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const length = Math.min(Math.max(parseInt(args[0], 10) || 16, 6), 64);
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;
    const password = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = password.length; i < length; i++) {
      password.push(all[Math.floor(Math.random() * all.length)]);
    }

    const generated = password.sort(() => Math.random() - 0.5).join('');
    const strength = length >= 20 ? 'Very Strong'
      : length >= 14 ? 'Strong'
        : length >= 10 ? 'Moderate' : 'Weak';
    return ctx.reply(style.renderInfo([
      'Generated Password',
      '',
      `\`\`\`${generated}\`\`\``,
      '',
      `Length: ${length} • Strength: ${strength}`,
    ]));
  },
};
