'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, renderArchiveSection, renderArchives, sendMenu, setMenu } = env;
cmd('archives', { cat: 12, desc: 'Catalogue ARCHIVES (sections à risque)', usage: 'archives [anti|nsfw|api|hack]', icon: '🔐' }, async (ctx) => {
  const key = String(ctx.args?.[0] || '').toLowerCase();
  const isOwner = !!ctx.isOwner;
  const OWNER_ONLY = { anti: true, nsfw: true, hack: true };
  if (!key) {
    setMenu(ctx.from, 12);
    return sendMenu(ctx.sock, ctx.from, renderArchives(ctx), ctx.msg);
  }
  if (OWNER_ONLY[key] && !isOwner) {
    return ctx.error(['SECTION RÉSERVÉE AU PROPRIÉTAIRE']);
  }
  if (!['anti', 'nsfw', 'api', 'hack'].includes(key)) {
    return ctx.error(['SECTION INCONNUE', `USAGE : ${config.prefix}archives [anti|nsfw|api|hack]`]);
  }
  setMenu(ctx.from, 12);
  return sendMenu(ctx.sock, ctx.from, renderArchiveSection(ctx, key), ctx.msg);
});
};
module.exports.maison = true;
