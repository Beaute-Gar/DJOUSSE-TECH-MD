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

const runLegacyBehavior = async (s, m, a, c) => { const phrases = [['English','Thank you'],['Spanish','Gracias'],['French','Merci'],['German','Danke'],['Italian','Grazie'],['Japanese','ありがとう (Arigatō)'],['Korean','감사합니다 (Gamsahamnida)'],['Chinese','谢谢 (Xièxiè)'],['Arabic','شكراً (Shukran)'],['Swahili','Asante'],['Hindi','धन्यवाद (Dhanyavaad)'],['Portuguese','Obrigado/a'],['Russian','Спасибо (Spasibo)'],['Turkish','Teşekkürler'],['Thai','ขอบคุณ (Khob khun)'],['Amharic','አመሰግናለሁ (Ameseginalehu)']]; c.reply(`🙏 *Thank You in 16 Languages*\n\n${phrases.map(([l,p])=>`*${l}:* ${p}`).join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":2,"entryOrder":344}
module.exports = {
  commands: ["thankyou","thanks2"],
  description: "Thank you in many languages",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
