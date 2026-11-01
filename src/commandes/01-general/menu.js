'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, isOwnerJid, persistConnectMethod, renderMainMenu, sendMenu, setMenu } = env;
cmd('menu', { cat: 1, desc: 'Menu interactif par chiffres', icon: '📋' }, async (ctx) => {
  /* Commutateur QR / Pairing :
       .menu qr
       .menu pairing            → numéro owner par défaut
       .menu pairing 237690000000 */
  const arg = String(ctx.args?.[0] || '').toLowerCase();
  if (['qr', 'pairing', 'pair'].includes(arg)) {
    if (!isOwnerJid(ctx.sender)) {
      return ctx.error(['COMMANDE RÉSERVÉE AU PROPRIÉTAIRE']);
    }
    const method = arg === 'qr' ? 'qr' : 'pairing';
    let phone = '';
    if (method === 'pairing') {
      phone = String(ctx.args?.[1] || config.ownerNumber[0] || '').replace(/\D/g, '');
      if (phone.length < 8 || phone.length > 15) {
        return ctx.error([
          'NUMÉRO PAIRING INVALIDE (8 À 15 CHIFFRES)',
          `USAGE : ${config.prefix}MENU PAIRING 237690000000`,
        ]);
      }
    }
    try {
      persistConnectMethod(method, phone);
    } catch (e) {
      return ctx.error(['ÉCRITURE .ENV IMPOSSIBLE', `[${e.message}]`]);
    }
    return ctx.success([
      'MÉTHODE DE CONNEXION ENREGISTRÉE',
      method === 'qr'
        ? '→ QR : SCAN AVEC UN SECOND APPAREIL'
        : `→ PAIRING : ${phone} (MÊME TÉLÉPHONE)`,
      'APPLIQUÉ AU PROCHAIN REDÉMARRAGE',
      'REDÉMARRE LE BOT POUR L’APPLIQUER',
    ]);
  }

  setMenu(ctx.from, 0);
  await sendMenu(ctx.sock, ctx.from, renderMainMenu(ctx), ctx.msg);
});
};
module.exports.maison = true;
