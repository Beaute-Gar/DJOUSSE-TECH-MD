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

const runLegacyBehavior = async (s, m, a, c) => { const workouts = [{name:'Full Body Blast',exercises:['20 Jumping Jacks','15 Push-ups','20 Squats','30s Plank','10 Burpees','15 Lunges (each leg)','20 Crunches','10 Mountain Climbers']},{name:'Core Crusher',exercises:['30s Plank','20 Crunches','15 Leg Raises','20 Russian Twists','30s Side Plank (each)','15 Bicycle Crunches','10 V-Ups','20 Flutter Kicks']},{name:'Cardio Fire',exercises:['30 Jumping Jacks','20 High Knees','15 Burpees','20 Mountain Climbers','30s Jump Rope','15 Star Jumps','20 Speed Skaters','30s Sprint in Place']},{name:'Upper Body',exercises:['20 Push-ups','15 Tricep Dips','10 Diamond Push-ups','15 Arm Circles','20 Shoulder Taps','10 Pike Push-ups','15 Superman','20 Punches']},{name:'Lower Body',exercises:['20 Squats','15 Lunges','20 Calf Raises','15 Jump Squats','20 Glute Bridges','10 Single-Leg Deadlifts','15 Wall Sits (30s)','20 Step-ups']}]; const w = workouts[Math.floor(Math.random()*workouts.length)]; c.reply(`💪 *${w.name}*\n\n${w.exercises.map((e,i) => `${i+1}. ${e}`).join('\n')}\n\n⏱️ Rest 30s between exercises\n🔄 Complete 3 rounds`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":0,"entryOrder":314}
module.exports = {
  commands: ["workout","wod"],
  description: "Random workout",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
