'use strict';

/**
 * .flash — « le levier ».
 * Le bot n'est pas le chef du groupe : il est l'instrument qui transmet à
 * WhatsApp la requête d'élévation d'un membre. Le pouvoir reste côté
 * WhatsApp : si le bot n'est pas admin, la requête échoue.
 *
 * Cycle : membre → .flash → bot (groupParticipantsUpdate 'promote') →
 * WhatsApp valide → confirmation dans le groupe.
 */

const COOLDOWN_MS = 15_000;
const dernierAppel = new Map();

function numero(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

module.exports = function enregistrer(env) {
  const { cmd } = env;

  cmd('flash', {
    cat: 2,
    desc: 'Auto-promotion admin via le bot (bot admin requis)',
    usage: 'flash',
    group: true,
    botAdmin: true,
    icon: '⚡',
  }, async (ctx) => {
    const maintenant = Date.now();
    const dernier = dernierAppel.get(ctx.sender) || 0;
    if (maintenant - dernier < COOLDOWN_MS) {
      const reste = Math.ceil((COOLDOWN_MS - (maintenant - dernier)) / 1000);
      return ctx.info(['FLASH EN RECHARGE', `RÉESSAIE DANS ${reste} S`]);
    }
    dernierAppel.set(ctx.sender, maintenant);

    if (ctx.isAdmin) {
      return ctx.info(['DÉJÀ ADMIN', 'TU ES DÉJÀ ADMINISTRATEUR DE CE GROUPE.']);
    }

    /* Le jid du message peut être un LID : on le remplace par l'identifiant
       exact du participant dans les métadonnées du groupe. */
    let cible = ctx.sender;
    try {
      const meta = await ctx.sock.groupMetadata(ctx.from);
      const moi = (meta?.participants || []).find((p) =>
        p.id === ctx.sender || (ctx.senderNum && numero(p.id) === String(ctx.senderNum)));
      if (moi?.id) cible = moi.id;
    } catch { /* on tentera avec le jid du message */ }

    try {
      await ctx.sock.groupParticipantsUpdate(ctx.from, [cible], 'promote');
      await ctx.react('⚡');
      console.log(`[FLASH] ${ctx.senderNum} promu admin dans ${ctx.from}`);
      return ctx.reply(
        `⚡ *FLASH !* @${ctx.senderNum} vient de passer administrateur via le bot.`,
        [cible],
      );
    } catch (e) {
      console.error('[FLASH] échec:', e.message);
      return ctx.error([
        'FLASH REFUSÉ',
        'LE BOT N’A PAS PU TRANSMETTRE LA REQUÊTE.',
        'VÉRIFIE QU’IL EST ADMINISTRATEUR DU GROUPE.',
      ]);
    }
  });
};

module.exports.maison = true;
