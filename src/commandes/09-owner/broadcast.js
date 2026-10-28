'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, getCachedChats, send } = env;
cmd('broadcast', ['bc'], { cat: 9, desc: 'Diffuser un message', usage: 'broadcast <texte>', owner: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}broadcast Hello à tous`);
  const chats = [...new Set(getCachedChats())]
    .filter((j) => j.endsWith('@s.whatsapp.net') || j.endsWith('@g.us'));
  await ctx.reply(`📡 Diffusion vers ${chats.length} chats...`);
  let ok = 0;
  for (const jid of chats) {
    try {
      await send(ctx.sock, jid, { text: `📢 *${config.botName}*\n\n${ctx.q}` });
      ok++;
      await new Promise((r) => setTimeout(r, 900));
    } catch (e) {}
  }
  await ctx.reply(`✅ Diffusion terminée : ${ok}/${chats.length} envoyés.`);
});
};
module.exports.maison = true;
