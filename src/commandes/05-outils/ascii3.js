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

const runLegacyBehavior = async (s, m, a, c) => { const arts = [{name:'Heart',art:'  ❤️❤️   ❤️❤️\n❤️❤️❤️❤️❤️❤️❤️\n❤️❤️❤️❤️❤️❤️❤️\n  ❤️❤️❤️❤️❤️\n    ❤️❤️❤️\n      ❤️'},{name:'Star',art:'    ⭐\n   ⭐⭐⭐\n  ⭐⭐⭐⭐⭐\n ⭐⭐⭐⭐⭐⭐⭐\n   ⭐⭐⭐\n  ⭐   ⭐'},{name:'Diamond',art:'    💎\n   💎💎💎\n  💎💎💎💎💎\n 💎💎💎💎💎💎💎\n  💎💎💎💎💎\n   💎💎💎\n    💎'}]; const art = arts[Math.floor(Math.random()*arts.length)]; c.reply(`🎨 *${art.name}*\n\n${art.art}`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":15,"entryOrder":438}
module.exports = {
  commands: ["ascii3","arttext"],
  description: "Text art patterns",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
