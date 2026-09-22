const { cmd } = require('../command.cjs');

cmd({
  pattern: 'warmup',
  category: 'owner',
  desc: 'État du système anti-ban',
  fromMe: true,
}, async (conn, m, args, ctx) => {
  const antiBan = require('../lib/anti-ban.cjs');
  const subCommand = args[0]?.toLowerCase();

  if (subCommand === 'reset') {
    antiBan.resetWarmup();
    return conn.sendMessage(ctx.from, {
      text: '✅ *Warmup reset*\n\nLe warmup repart au jour 1.',
    }, { quoted: m });
  }

  if (subCommand === 'restricted') {
    const restricted = antiBan.isRestricted();
    return conn.sendMessage(ctx.from, {
      text: restricted
        ? '🚨 *Compte restreint*\n\nUtilise `.warmup reset` pour effacer le flag.'
        : '✅ *Compte actif*\n\nAucune restriction détectée.',
    }, { quoted: m });
  }

  const report = antiBan.formatStatusReport();
  await conn.sendMessage(ctx.from, { text: report }, { quoted: m });
});
