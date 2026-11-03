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

const runLegacyBehavior = async (s, m, a, c) => { const recipes = [{name:'Avocado Toast',time:'5 min',ingredients:['2 slices bread','1 avocado','Salt & pepper','Lemon juice','Red pepper flakes'],steps:'1. Toast bread\n2. Mash avocado with lemon, salt, pepper\n3. Spread on toast\n4. Top with red pepper flakes'},{name:'Scrambled Eggs',time:'10 min',ingredients:['3 eggs','1 tbsp butter','Salt & pepper','Optional: cheese, herbs'],steps:'1. Whisk eggs with salt & pepper\n2. Melt butter in pan over medium heat\n3. Pour eggs, stir gently\n4. Remove while still slightly wet'},{name:'Banana Smoothie',time:'5 min',ingredients:['2 bananas','1 cup milk','1 tbsp honey','Ice cubes','Optional: peanut butter'],steps:'1. Add all ingredients to blender\n2. Blend until smooth\n3. Pour and enjoy!'},{name:'Quick Pasta',time:'15 min',ingredients:['200g pasta','Olive oil','Garlic','Parmesan','Salt & pepper'],steps:'1. Boil pasta until al dente\n2. Sauté garlic in olive oil\n3. Toss pasta with garlic oil\n4. Top with parmesan'}]; const r = recipes[Math.floor(Math.random()*recipes.length)]; c.reply(`🍳 *${r.name}*\n⏱️ ${r.time}\n\n*Ingredients:*\n${r.ingredients.map(i=>'• '+i).join('\n')}\n\n*Steps:*\n${r.steps}`); };

// @legacy-order {"sourceFile":"05-outils/health-fitness.js","sourceOrder":111,"definitionIndex":9,"entryOrder":323}
module.exports = {
  commands: ["recipe","quickrecipe"],
  description: "Quick recipe",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
