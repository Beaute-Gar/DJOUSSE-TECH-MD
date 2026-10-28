'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, bullet, cmd, config, isPrimaryOwner, num, saveState, state, targetFrom, title, toUnicode } = env;
cmd('sudo', {
  cat: 9, desc: 'Gérer les sudo (co-owners autorisés)', usage: 'sudo add|del|list <numéro>', owner: true, icon: '🔑',
}, async (ctx) => {
  const sub = (ctx.args[0] || '').toLowerCase();
  state.settings.sudo = Array.isArray(state.settings.sudo) ? state.settings.sudo : [];
  if (sub === 'list') {
    const primary = config.ownerNumber.map((n) => `👑 +${n}`).join('\n') || '—';
    const sudo = state.settings.sudo.length
      ? state.settings.sudo.map((n) => `🔑 +${n}`).join('\n')
      : 'Aucun sudo';
    return ctx.reply(
      buildFrame('AUTORISATIONS', [
        title(toUnicode('OWNERS PRINCIPAUX')),
        primary,
        title(toUnicode('SUDO')),
        sudo,
        bullet('AIDE', `${config.prefix}sudo add 2376...`),
      ])
    );
  }
  if (sub === 'add' || sub === 'del' || sub === 'remove') {
    let n = (ctx.args[1] || '').replace(/\D/g, '');
    if (!n && ctx.msg) {
      const t = targetFrom(ctx);
      if (t) n = num(t);
    }
    if (!n || n.length < 8) {
      return ctx.error(['USAGE', `${config.prefix}SUDO ADD 2376XXXXXXX`, 'OU MENTIONNE LA PERSONNE']);
    }
    if (sub === 'add') {
      if (isPrimaryOwner(n)) return ctx.error(['DÉJÀ OWNER PRINCIPAL']);
      if (!state.settings.sudo.includes(n)) state.settings.sudo.push(n);
      saveState();
      return ctx.success(['SUDO AJOUTÉ', `+${n}`, 'PEUT UTILISER LES COMMANDES OWNER']);
    }
    state.settings.sudo = state.settings.sudo.filter((x) => x !== n);
    saveState();
    return ctx.success(['SUDO RETIRÉ', `+${n}`]);
  }
  return ctx.error([
    'USAGE',
    `${config.prefix}SUDO LIST`,
    `${config.prefix}SUDO ADD <NUMÉRO>`,
    `${config.prefix}SUDO DEL <NUMÉRO>`,
    `${config.prefix}AUTHCODE  (code à usage unique)`,
  ]);
});
};
module.exports.maison = true;
