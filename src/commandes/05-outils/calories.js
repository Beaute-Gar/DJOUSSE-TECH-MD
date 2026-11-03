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

const runLegacyBehavior = async (s, m, a, c) => { const foods = {apple:{cal:95,protein:'0.5g',carbs:'25g',fat:'0.3g'},banana:{cal:105,protein:'1.3g',carbs:'27g',fat:'0.4g'},rice:{cal:206,protein:'4.3g',carbs:'45g',fat:'0.4g'},chicken:{cal:165,protein:'31g',carbs:'0g',fat:'3.6g'},egg:{cal:78,protein:'6g',carbs:'0.6g',fat:'5g'},bread:{cal:79,protein:'2.7g',carbs:'15g',fat:'1g'},milk:{cal:149,protein:'8g',carbs:'12g',fat:'8g'},potato:{cal:161,protein:'4.3g',carbs:'37g',fat:'0.2g'},pasta:{cal:220,protein:'8g',carbs:'43g',fat:'1.3g'},fish:{cal:136,protein:'25g',carbs:'0g',fat:'3.5g'},beef:{cal:250,protein:'26g',carbs:'0g',fat:'15g'},pizza:{cal:285,protein:'12g',carbs:'36g',fat:'10g'},burger:{cal:354,protein:'20g',carbs:'29g',fat:'17g'},salad:{cal:20,protein:'1.8g',carbs:'3.3g',fat:'0.2g'},yogurt:{cal:100,protein:'17g',carbs:'6g',fat:'0.7g'},avocado:{cal:240,protein:'3g',carbs:'13g',fat:'22g'},orange:{cal:62,protein:'1.2g',carbs:'15g',fat:'0.2g'},mango:{cal:99,protein:'1.4g',carbs:'25g',fat:'0.6g'},watermelon:{cal:46,protein:'0.9g',carbs:'12g',fat:'0.2g'},peanuts:{cal:567,protein:'26g',carbs:'16g',fat:'49g'}}; const q = (a[0]||'').toLowerCase(); const f = foods[q]; if (!f) return c.reply('Usage: .calories <food>\nFoods: ' + Object.keys(foods).join(', ')); c.reply(`🍽️ *${q.charAt(0).toUpperCase()+q.slice(1)}* (per serving)\n\nCalories: ${f.cal} kcal\nProtein: ${f.protein}\nCarbs: ${f.carbs}\nFat: ${f.fat}`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":2,"entryOrder":316}
module.exports = {
  commands: ["calories","food"],
  description: "Food calorie lookup",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
