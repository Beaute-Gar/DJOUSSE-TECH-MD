// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":10,"entryOrder":142}
'use strict';

const style = require('../../config/style');

const USER_AGENTS = Object.freeze([
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/17.0',
  'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
]);

module.exports = {
  commands: ['useragent', 'ua'],
  description: 'Random user agent',
  permission: 'public',
  run: async (_sock, _message, _args, ctx) => {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    return ctx.reply(style.renderInfo(['Random User Agent', '', `\`${userAgent}\``]));
  },
};
