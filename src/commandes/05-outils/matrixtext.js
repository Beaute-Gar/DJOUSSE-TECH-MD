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

const runLegacyBehavior = async (s, m, a, c) => { const chars = '01'; const lines = Array(8).fill(0).map(() => Array(20).fill(0).map(() => chars[Math.floor(Math.random()*2)]).join(' ')); c.reply(`💚 *Matrix*\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":0,"entryOrder":423}
module.exports = {
  commands: ["matrixtext"],
  description: "Matrix-style text",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
