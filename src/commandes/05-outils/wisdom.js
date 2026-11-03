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

const runLegacyBehavior = async (s, m, a, c) => { const wisdom = ["The wise man knows that he knows nothing.","Experience is the teacher of all things.","Knowledge speaks, but wisdom listens.","The beginning of wisdom is the definition of terms.","It is the mark of an educated mind to be able to entertain a thought without accepting it.","In seeking wisdom, the first step is silence.","Wisdom is not a product of schooling but of the lifelong attempt to acquire it.","The only true wisdom is knowing you know nothing.","Science is organized knowledge. Wisdom is organized life.","The doorstep to the temple of wisdom is knowledge of your own ignorance."]; c.reply(`🦉 *Wisdom*\n\n_"${wisdom[Math.floor(Math.random()*wisdom.length)]}"_`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":12,"entryOrder":435}
module.exports = {
  commands: ["wisdom","wisdomquote"],
  description: "Random wisdom",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
