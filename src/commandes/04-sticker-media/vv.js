'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, downloadVV, findOnceTarget, onceMediaInfo, renderSuccess, send, sendRecovered } = env;
cmd('vv', {
  cat: 4, desc: 'Récupérer un média en vue unique',
  usage: 'vv (réponds à un média vue unique)', icon: '🔓',
}, async (ctx) => {
  /* ── Comportement à l'identique de la référence DJOUSSE-TECH-VV :
        la commande accepte le MÉDIA CITÉ tel quel, enveloppe vue
        unique ou non. WhatsApp retire souvent l'enveloppe
        viewOnceMessage* du message cité (elle n'est qu'une marque
        d'affichage côté téléphone) ; exiger l'enveloppe rejetait à
        tort une récupération pourtant valide — le média lui-même est
        bien présent dans le cache ou dans quotedMessage.

        La référence réagit ⏳ puis ✅/❌ : même feedback ici, transport
        garanti G2 via send(). Chaque refus dit POURQUOI. ── */
  await send(ctx.sock, ctx.from, { react: { text: '⏳', key: ctx.msg.key } });
  const target = findOnceTarget(ctx.msg);
  if (!target) {
    await send(ctx.sock, ctx.from, { react: { text: '❌', key: ctx.msg.key } });
    return ctx.error([
      'AUCUN MESSAGE CITÉ',
      'RÉPONDS DIRECTEMENT AU MÉDIA VUE UNIQUE',
      `PUIS ${config.prefix}VV`,
    ]);
  }
  const info = onceMediaInfo(target);
  if (!info) {
    await send(ctx.sock, ctx.from, { react: { text: '❌', key: ctx.msg.key } });
    return ctx.error([
      'MÉDIA CITÉ INTROUVABLE OU EXPIRÉ',
      'LA VUE UNIQUE A DÉJÉ ÉTÉ CONSOMMÉE',
      'DEMANDE-LUI DE RENVOYER LE MÉDIA',
    ]);
  }
  await ctx.reply(config.messages.wait);
  try {
    const label = String(info.type).replace('Message', '').toUpperCase();
    const result = await downloadVV(ctx.sock, info);
    await sendRecovered(ctx.sock, ctx.from, result, ctx.msg,
      renderSuccess(['VUE UNIQUE RÉCUPÉRÉE', `${label} CONVERTI EN CLASSIQUE`]));
    await send(ctx.sock, ctx.from, { react: { text: '✅', key: ctx.msg.key } });
  } catch (e) {
    await send(ctx.sock, ctx.from, { react: { text: '❌', key: ctx.msg.key } });
    await ctx.error(['MÉDIA INDISPONIBLE OU EXPIRÉ', `[${e.message}]`]);
  }
});
};
module.exports.maison = true;
