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

const runLegacyBehavior = async (s, m, a, c) => { c.reply('⠀⠀⠀⠀⠀⠀⠀⢀⡔⠋⢉⠩⡁⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⡇⠁⠀⠀⠀⠀⠀⢁⡢⠁\n⠀⠀⠀⠀⠀⢁⠗⢁⡤⢤⣤⠀⠀⡐⠁\n⠀⠀⠀⠀⠀⠀⠄⠁⠀⠁⢔⢁⡁⠔⠀\n⠀⠀⠀⠀Problem? 😏'); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":13,"entryOrder":436}
module.exports = {
  commands: ["troll","trollface"],
  description: "Troll text art",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
