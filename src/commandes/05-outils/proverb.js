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

const runLegacyBehavior = async (s, m, a, c) => { const proverbs = ['"If you want to go fast, go alone. If you want to go far, go together." — African Proverb','"The child who is not embraced by the village will burn it down to feel its warmth." — African Proverb','"Smooth seas do not make skillful sailors." — African Proverb','"Knowledge without wisdom is like water in the sand." — Guinean Proverb','"A tree is known by its fruit." — Zulu Proverb','"He who learns, teaches." — Ethiopian Proverb','"Until the lion tells his story, the tale of the hunt will always glorify the hunter." — African Proverb','"No matter how hot your anger is, it cannot cook yams." — Nigerian Proverb','"The best time to plant a tree was 20 years ago. The second best time is now." — African Proverb','"When there is no enemy within, the enemies outside cannot hurt you." — African Proverb','"Rain does not fall on one roof alone." — Cameroonian Proverb','"A wise person will always find a way." — Tanzanian Proverb','"Do not look where you fell, but where you slipped." — Liberian Proverb','"By trying often, the monkey learns to jump from the tree." — Bugandan Proverb','"Sticks in a bundle are unbreakable." — Kenyan Proverb']; c.reply(`🌍 *African Proverb*\n\n_${proverbs[Math.floor(Math.random()*proverbs.length)]}_`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":4,"entryOrder":346}
module.exports = {
  commands: ["proverb","wisdom2"],
  description: "African proverb",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
