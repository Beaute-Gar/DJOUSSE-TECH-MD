'use strict';

module.exports = function enregistrer(env) {
  const { cmd, withNetworkTimeout } = env;
cmd('joke', { cat: 7, desc: 'Une blague' }, async (ctx) => {
  try {
    const j = await withNetworkTimeout(async (signal) => {
      const res = await fetch('https://official-joke-api.appspot.com/random_joke', { signal });
      if (!res.ok) throw new Error(`API blagues HTTP ${res.status}.`);
      return res.json();
    }, 15000, 'API blagues');
    await ctx.reply(`😂 ${j.setup}\n\n*${j.punchline}*`);
  } catch (e) {
    await ctx.reply('❌ Blague indisponible.');
  }
});
};
module.exports.maison = true;
