// @legacy-order {"sourceFile":"10-divers/tempmail2.js","sourceOrder":233,"definitionIndex":0,"entryOrder":640}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['tempmailhelp'],
  description: 'Extended temporary mail commands',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => ctx.reply(style.renderInfo([
    '📧 TempMail Help',
    '',
    'Commands:',
    '• `.tempmail` — Generate a new temporary email',
    '• `.tempinbox <email>` — Check inbox of an email',
    '• `.readmail <email> <index>` — Read a specific email (1, 2, 3...)',
    '• `.delmail` — Clear your saved temp email',
    '• `.tempmailhelp` — Show this help',
    '',
    'Example flow:',
    '1. `.tempmail` → get email address',
    '2. Use it to sign up somewhere',
    '3. `.tempinbox <email>` → check for new messages',
    '4. `.readmail <email> 1` → read first message',
  ])),
};
