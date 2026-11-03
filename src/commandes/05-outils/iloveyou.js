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

const runLegacyBehavior = async (s, m, a, c) => { const phrases = [['English','I love you ❤️'],['Spanish','Te quiero / Te amo'],['French','Je t\'aime'],['Italian','Ti amo'],['German','Ich liebe dich'],['Japanese','愛してる (Aishiteru)'],['Korean','사랑해 (Saranghae)'],['Chinese','我爱你 (Wǒ ài nǐ)'],['Arabic','أحبك (Uhibbuka)'],['Swahili','Nakupenda'],['Hindi','मैं तुमसे प्यार करता हूं'],['Portuguese','Eu te amo'],['Russian','Я тебя люблю'],['Turkish','Seni seviyorum'],['Thai','ฉันรักคุณ'],['Greek','Σ\'αγαπώ']]; c.reply(`💕 *I Love You in 16 Languages*\n\n${phrases.map(([l,p])=>`*${l}:* ${p}`).join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":1,"entryOrder":343}
module.exports = {
  commands: ["iloveyou","ily"],
  description: "I love you in many languages",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
