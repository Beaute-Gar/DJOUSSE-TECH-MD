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

const runLegacyBehavior = async (s, m, a, c) => { const pastas = ["I just wanted to say that I think you're really cool and I hope we can be friends. Wait, I sent that in the wrong chat. 😳","According to all known laws of aviation, there is no way a bee should be able to fly. Its wings are too small to get its fat little body off the ground. 🐝","I'm not crying, you're crying. Actually nobody is crying because this is a text message and emotions aren't real on the internet. 😤","If you or a loved one has been diagnosed with too much free time, you may be entitled to touch grass. 🌿","My WiFi went down for 5 minutes so I had to talk to my family. They seem like nice people. 📶"]; c.reply(pastas[Math.floor(Math.random()*pastas.length)]); };

// @legacy-order {"sourceFile":"05-outils/misc-extras.js","sourceOrder":144,"definitionIndex":2,"entryOrder":425}
module.exports = {
  commands: ["copypasta","pasta"],
  description: "Random copypasta",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
