'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, send, state } = env;
cmd('statut', ['status'], { cat: 9, desc: 'Publier un texte en statut WhatsApp', usage: 'statut <texte>', owner: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}statut Bonjour le monde`);
  const list = Object.keys(state.users)
    .filter((n) => /^\d{5,}$/.test(n))
    .map((n) => `${n}@s.whatsapp.net`);
  await send(ctx.sock, 
    'status@broadcast',
    { text: ctx.q.slice(0, 500) },
    { statusJidList: list }
  );
  await ctx.reply(`✅ Statut publié${list.length ? ` vers ${list.length} contacts` : ''}.`);
});
};
module.exports.maison = true;
