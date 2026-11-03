// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":4,"entryOrder":136}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['timestamp', 'epoch'],
  description: 'Unix timestamp',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const timestamp = Number.parseInt(args[0], 10);
    if (timestamp) {
      const date = new Date(timestamp * (timestamp > 1e12 ? 1 : 1000));
      if (Number.isNaN(date.getTime())) {
        return ctx.reply(style.renderError(['Invalid timestamp']));
      }

      return ctx.reply(style.renderInfo([
        `⏱️ Timestamp\n\n${timestamp} → ${date.toISOString()}\n${date.toLocaleString()}`,
      ]));
    }

    const now = Date.now();
    return ctx.reply(style.renderInfo([
      `⏱️ Current Timestamp\n\nSeconds: ${Math.floor(now / 1000)}\nMilliseconds: ${now}\nISO: ${new Date(now).toISOString()}`,
    ]));
  },
};
