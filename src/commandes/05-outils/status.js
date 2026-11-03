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

const runLegacyBehavior = async (s, m, a, c) => { const statuses = ["Living my best life ✨","Not perfect, but working on it 💪","Dream big, work hard, stay humble 🌟","Good vibes only ☀️","Be yourself; everyone else is taken 🦋","Making memories 📸","Work in progress 🚧","Blessed and grateful 🙏","Silent but deadly 🤫","Living proof that miracles exist 🌈","Currently pretending to be a functioning adult 😅","Professional overthinker 🧠","Powered by caffeine and dreams ☕","Error 404: Status not found 💻","I came. I saw. I made it awkward. 🤷"]; c.reply(`📱 *Status Ideas*\n\n${Array(5).fill(0).map(() => `• ${statuses[Math.floor(Math.random()*statuses.length)]}`).join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":16,"entryOrder":439}
module.exports = {
  commands: ["status2","whatsappstatus"],
  description: "Random status ideas",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
