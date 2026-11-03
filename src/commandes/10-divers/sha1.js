'use strict';

const crypto = require('node:crypto');
const style = require('../../config/style');

module.exports = {
  commands: ['sha1'],
  description: 'Generate a SHA-1 digest',
  usage: '.sha1 <text>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Indique le texte à hacher. Exemple : .sha1 hello world']));
    }

    const digest = crypto.createHash('sha1').update(text).digest('hex');
    return ctx.reply(style.renderInfo(['SHA-1', '', `Texte : ${text}`, '', digest]));
  },
};
