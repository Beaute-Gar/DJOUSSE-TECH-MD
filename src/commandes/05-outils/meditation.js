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

const runLegacyBehavior = async (s, m, a, c) => { const exercises = [{name:'4-7-8 Breathing',steps:'1. Breathe IN for 4 seconds\n2. HOLD for 7 seconds\n3. Breathe OUT for 8 seconds\n4. Repeat 4 times'},{name:'Box Breathing',steps:'1. Breathe IN for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT for 4 seconds\n4. HOLD for 4 seconds\n5. Repeat 4 times'},{name:'5-5-5 Calming',steps:'1. Breathe IN for 5 seconds\n2. Breathe OUT for 5 seconds\n3. Name 5 things you can see\n4. Name 4 things you can touch\n5. Name 3 things you can hear'}]; const ex = exercises[Math.floor(Math.random()*exercises.length)]; c.reply(`🧘 *${ex.name}*\n\n${ex.steps}\n\n_Take a moment to relax and focus on your breath._ 🌿`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":5,"entryOrder":319}
module.exports = {
  commands: ["meditation","breathe"],
  description: "Breathing exercise",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
