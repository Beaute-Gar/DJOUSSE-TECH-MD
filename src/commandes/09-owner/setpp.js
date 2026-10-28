'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, downloadFrom, mediaInfo } = env;
cmd('setpp', ['setpic'], {
  cat: 9, desc: 'Photo de profil du bot (setpp delete = retirer)', usage: 'setpp (image) · setpp delete', owner: true, icon: '🖼️',
}, async (ctx) => {
  const sub = (ctx.args[0] || '').toLowerCase();
  if (sub === 'delete' || sub === 'del' || sub === 'remove') {
    try {
      await ctx.sock.removeProfilePicture(ctx.sock.user.id);
      return await ctx.success(['PHOTO DE PROFIL RETIRÉE']);
    } catch (e) {
      return await ctx.reply(`❌ setpp delete impossible : ${e.message}`);
    }
  }
  const info = mediaInfo(ctx.msg);
  if (!info || !info.mimetype?.startsWith('image/')) {
    return ctx.reply(`❌ Réponds à une image ou envoie une image avec ${config.prefix}setpp`);
  }
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    await ctx.sock.updateProfilePicture(ctx.sock.user.id, buffer);
    await ctx.success(['PHOTO DE PROFIL MISE À JOUR']);
  } catch (e) {
    await ctx.reply(`❌ setpp impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
