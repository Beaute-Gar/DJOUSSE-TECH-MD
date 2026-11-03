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

const runLegacyBehavior = async (s, m, a, c) => { const opts = a.join(' ').split(/[,|\/]/); if (opts.length < 2) return c.reply('Usage: .choose option1, option2, option3'); const picked = opts[Math.floor(Math.random()*opts.length)].trim(); c.reply(`🎯 *Decision Maker*\n\nOptions: ${opts.map(o=>o.trim()).join(' | ')}\n\nI choose: *${picked}*`); };

// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":8,"entryOrder":730}
module.exports = {
  commands: ["pick","decide"],
  description: "Pick random option",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
