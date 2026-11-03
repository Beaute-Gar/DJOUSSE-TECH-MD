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

const runLegacyBehavior = async (s, m, a, c) => { const captions = ["Living for the moments you can't put into words 💫","Chasing sunsets and dreams 🌅","Be the energy you want to attract ⚡","Life is short, make every hair flip count 💁","Sunshine mixed with a little hurricane 🌪️","Leave a little sparkle wherever you go ✨","Stay golden 🌟","Making memories one adventure at a time 🗺️","Happiness looks gorgeous on you 😊","Be a voice, not an echo 📣","Plot twist: I don't care 🎭","Self love is the best love 💕","Taking the scenic route 🛤️","Vibes don't lie 🎵","This is my era ✨"]; c.reply(`📸 *Caption Ideas*\n\n${Array(5).fill(0).map(() => `• ${captions[Math.floor(Math.random()*captions.length)]}`).join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":18,"entryOrder":441}
module.exports = {
  commands: ["igcaption"],
  description: "Random caption ideas",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
