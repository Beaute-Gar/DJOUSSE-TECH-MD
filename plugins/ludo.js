'use strict';
/**
 * DJOUSSE TECH • LUDO — pont entre le moteur `ludo/` et le registre de `handler.js`.
 *
 * ADAPTATION (fichier livré par l'auteur du module, réécrit pour CE bot) :
 *   Ce bot n'a pas de dossier `plugins/` auto-chargé : toutes les commandes sont
 *   déclarées dans handler.js avec `cmd(names, opts, handler)`. Le plugin est donc
 *   exporté en fonction et branché par handler.js :
 *
 *       require('./plugins/ludo')(cmd, commands);
 *
 * Installation : dossier `ludo/` à la racine + ce fichier dans `plugins/`
 *                + `npm install @napi-rs/canvas` + redémarrage.
 *
 * Commandes : .ludo <creer|solo|rejoindre|start|quitter|stop|pos|plateau|regles>
 *             .dé · .pion <1-4>
 */

/* Commandes réservées par le module (alerte si le bot les utilise déjà). */
const WANTED = ['ludo', 'de', 'dé', 'lancer', 'pion'];

/* Service unique d'envoi WhatsApp (G2) : importé sous un autre nom car
   `send` désigne déjà, plus bas, l'envoi vers la discussion courante. */
const { send: sendTo } = require('../lib/wa-send');

let ludo = null;
let liveSock = null; // dernier socket vu : un timer LUDO (90 s) ne doit jamais réutiliser un socket fermé après reconnexion

/**
 * Chargement PARESSEUX du moteur : `ludo/src` importe `@napi-rs/canvas` au
 * démarrage, on ne veut pas faire planter handler.js si la dépendance manque.
 */
function getLudo() {
  if (ludo) return ludo;
  let createLudo;
  try {
    ({ createLudo } = require('../ludo/src'));
  } catch (e) {
    throw new Error(`moteur ludo/ introuvable ou @napi-rs/canvas absent → « npm install @napi-rs/canvas » (${e.message})`);
  }
  ludo = createLudo();
  return ludo;
}

/** Pont WhatsApp : le module n'envoie que du texte et des images, cités sur le message. */
function makeIO(ctx) {
  const { from, msg } = ctx;
  const send = (content) => sendTo(liveSock || ctx.sock, from, content, { quoted: msg });
  /* Les joueurs virtuels (robot@s.whatsapp.net) sont affichés mais jamais
     mentionnés : WhatsApp n'accepte que des JIDs réels dans `mentions`. */
  const clean = (list) => (list || []).filter((j) => typeof j === 'string' && /^\d+@/.test(j));
  return {
    text: (text, mentions) => { const m = clean(mentions); return send(m.length ? { text, mentions: m } : { text }); },
    image: (image, caption, mentions) => send({ image, caption, mentions: clean(mentions) }),
  };
}

/** Un handler par commande : même pont, seul `cmd` change ('ludo' | 'de' | 'pion'). */
function bridge(kind) {
  return async (ctx) => {
    liveSock = ctx.sock; // socket courant (le bot en recrée à chaque reconnexion)
    await ctx.react('🎲');
    try {
      await getLudo().handle({
        chatId: ctx.from,
        /* Identité : ctx.sender = participant du groupe (PN ou LID selon le
           groupe), stable d'un message à l'autre → le bot ne se trompe pas
           de joueur. Le nom affiché vient du pushname WhatsApp. */
        sender: { id: ctx.sender, name: ctx.msg?.pushName || 'Joueur' },
        isAdmin: !!(ctx.isAdmin || ctx.isOwner),
        cmd: kind,
        args: ctx.args || [],
        io: makeIO(ctx),
      });
    } catch (e) {
      console.error('[LUDO]', e);
      await ctx.react('❌');
      await ctx.reply(`❌ LUDO : ${e.message || e}`);
    }
  };
}

/**
 * Branchement des commandes (appelé par handler.js, après toutes les autres).
 * @param {Function} cmd     registre handler.js : cmd(names, opts, handler)
 * @param {Map}      commands registre en cours (pour détecter les doublons)
 */
module.exports = function registerLudo(cmd, commands) {
  /* ── Anti-doublon : on compare avec toutes les clés (noms + alias) ── */
  if (commands && typeof commands.keys === 'function') {
    const taken = new Set(commands.keys());
    const clash = WANTED.filter((n) => taken.has(n));
    if (clash.length) {
      console.warn(`[LUDO] ⚠️ commandes déjà présentes dans le bot : ${clash.join(', ')} — elles seront écrasées par LUDO.`);
    }
  }

  const o = (desc, usage) => ({ cat: 7, desc, usage, icon: '🎲' });

  /* `.dé` : nom principal ASCII (affichage menu) + alias accentués, en forme
     NFC et NFD (un clavier mobile peut envoyer « e » + accent combinant). */
  const acute = (s) => [s, s.normalize('NFD')];

  cmd(['ludo', 'ludogame'], o('LUDO 2-4 joueurs : .ludo creer | solo | rejoindre | start | pos | plateau'), bridge('ludo'));
  cmd(['de', ...acute('dé'), ...acute('dés'), 'lancer', 'dice'], o('LUDO : lancer le dé', 'dé'), bridge('de'));
  cmd(['pion', 'pawn'], o('LUDO : déplacer un pion', 'pion 1-4'), bridge('pion'));
};
