// @legacy-order {"sourceFile":"10-divers/shorturl.js","sourceOrder":211,"definitionIndex":0,"entryOrder":605}
'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['shorten'],
  description: 'Shorten a URL using TinyURL',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    if (!args[0]) return ctx.reply(style.renderError(['Usage: .shorten <url>']));
    try {
      const response = await axios.get(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`,
      );
      return ctx.reply(style.renderInfo(['Shortened URL', '', String(response.data)]));
    } catch {
      return ctx.reply(style.renderError(['Failed to shorten URL.']));
    }
  },
};
