'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, withNetworkTimeout } = env;
cmd('convert', { cat: 8, desc: 'Conversion de devises', usage: 'convert 100 USD EUR' }, async (ctx) => {
  const m = ctx.q.match(/([\d.,]+)\s+([a-zA-Z]{3})\s+(?:en|to|->)?\s*([a-zA-Z]{3})/);
  if (!m) return ctx.reply(`❌ Usage : ${config.prefix}convert 100 USD EUR`);
  const amount = parseFloat(m[1].replace(',', '.'));
  const from = m[2].toUpperCase();
  const to = m[3].toUpperCase();
  try {
    const j = await withNetworkTimeout(async (signal) => {
      const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { signal });
      if (!res.ok) throw new Error(`Service de change HTTP ${res.status}.`);
      return res.json();
    }, 15000, 'Conversion de devises');
    const rate = j.rates?.[to];
    if (!rate) throw new Error('devise inconnue');
    await ctx.reply(`💱 *${amount} ${from}* = *${(amount * rate).toFixed(2)} ${to}*\nTaux : 1 ${from} = ${rate} ${to}`);
  } catch (e) {
    await ctx.reply(`❌ Conversion : ${e.message}`);
  }
});
};
module.exports.maison = true;
