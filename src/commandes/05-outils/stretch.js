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

const runLegacyBehavior = async (s, m, a, c) => { const stretches = ['Neck rolls (30s each direction)','Shoulder shrugs (10 reps)','Arm crossover stretch (15s each)','Tricep stretch (15s each arm)','Chest opener (30s)','Standing quad stretch (15s each)','Hamstring stretch (15s each)','Calf stretch (15s each)','Hip flexor stretch (15s each)','Child\'s pose (30s)','Cat-cow stretch (10 reps)','Seated twist (15s each side)']; c.reply(`🧘 *Stretching Routine*\n\n${stretches.map((s,i) => `${i+1}. ${s}`).join('\n')}\n\n_Hold each stretch gently, don't bounce!_`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":1,"entryOrder":315}
module.exports = {
  commands: ["stretch","stretching"],
  description: "Stretching routine",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
