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

const runLegacyBehavior = async (s, m, a, c) => { const poses = [{name:'Mountain Pose (Tadasana)',desc:'Stand tall, feet together, arms at sides. Focus on grounding through your feet.',level:'Beginner'},{name:'Downward Dog (Adho Mukha Svanasana)',desc:'Hands and feet on floor, hips high, forming an inverted V shape.',level:'Beginner'},{name:'Warrior I (Virabhadrasana I)',desc:'Lunge position, back foot angled, arms reaching up.',level:'Beginner'},{name:'Tree Pose (Vrksasana)',desc:'Stand on one leg, other foot on inner thigh, hands at heart or overhead.',level:'Beginner'},{name:'Cobra Pose (Bhujangasana)',desc:'Lie face down, hands under shoulders, press up opening chest.',level:'Beginner'},{name:'Child\'s Pose (Balasana)',desc:'Kneel, sit on heels, fold forward with arms extended.',level:'Beginner'},{name:'Plank Pose (Phalakasana)',desc:'Push-up position, body straight, core engaged.',level:'Intermediate'},{name:'Crow Pose (Bakasana)',desc:'Squat, hands on floor, lean forward balancing knees on triceps.',level:'Advanced'}]; const p = poses[Math.floor(Math.random()*poses.length)]; c.reply(`🧘 *${p.name}*\n\nLevel: ${p.level}\n\n${p.desc}\n\nHold for 30-60 seconds.`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":8,"entryOrder":322}
module.exports = {
  commands: ["yoga","yogapose"],
  description: "Random yoga pose",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
