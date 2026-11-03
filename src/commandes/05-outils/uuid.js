'use strict';
const style = require('../../config/style');

const styledContext = (context) => new Proxy(context, {
  get(target, property, receiver) {
    if (property === 'reply') {
      return (message, ...options) => {
        const text = String(message);
        const render = text.startsWith('Usage:') || text.startsWith(String.fromCodePoint(0x274c)) || /^Invalid\b/.test(text) ? style.renderError : style.renderInfo;
        return target.reply(render([text]), ...options);
      };
    }
    return Reflect.get(target, property, receiver);
  },
});

const runLegacyBehavior = async (s, m, a, c) => { const { randomUUID } = require('crypto'); const count = Math.min(parseInt(a[0]) || 1, 10); const uuids = Array(count).fill(0).map(() => randomUUID()); c.reply(`🔑 *UUID Generator*\n\n${uuids.join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":13,"entryOrder":735}
module.exports = {
  commands: ["uuid","guid"],
  description: "Generate UUID",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
