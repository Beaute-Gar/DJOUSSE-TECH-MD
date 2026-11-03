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

const runLegacyBehavior = async (s, m, a, c) => { const sender = c.from.split('@')[0]; c.reply(`👤 *About @${sender}*\n\nCoolness: ${Math.floor(Math.random()*101)}%\nHumor: ${Math.floor(Math.random()*101)}%\nIntelligence: ${Math.floor(Math.random()*101)}%\nKindness: ${Math.floor(Math.random()*101)}%\nLuck: ${Math.floor(Math.random()*101)}%\n\n_Generated for fun! 😄_`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":10,"entryOrder":433}
module.exports = {
  commands: ["aboutme","myprofile"],
  description: "Create an about me",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
