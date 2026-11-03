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

const runLegacyBehavior = async (s, m, a, c) => { const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']; const [s1, s2] = [a[0]?.toLowerCase(), a[1]?.toLowerCase()]; if (!s1 || !s2 || !signs.includes(s1) || !signs.includes(s2)) return c.reply('Usage: .zmatch <sign1> <sign2>\nSigns: ' + signs.join(', ')); const score = (s1.length * s2.length * 7 + s1.charCodeAt(0) + s2.charCodeAt(0)) % 101; c.reply(`♈ *Zodiac Match*\n\n${s1.charAt(0).toUpperCase()+s1.slice(1)} + ${s2.charAt(0).toUpperCase()+s2.slice(1)}\n\nCompatibility: ${score}%\n${'💕'.repeat(Math.floor(score/20))}\n\n${score > 80 ? 'Amazing match! 🌟' : score > 50 ? 'Good potential! ✨' : 'Interesting combination! 🤔'}`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":11,"entryOrder":434}
module.exports = {
  commands: ["zodiacmatch","zmatch"],
  description: "Zodiac compatibility",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
