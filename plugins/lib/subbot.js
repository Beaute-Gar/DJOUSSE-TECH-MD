'use strict';
/**
 * Shim DJOUSSE : '../lib/subbot' (fonction sous-bot).
 * Un sous-bot = une session secondaire qui relaie des commandes.
 * Volontairement neutralisé ici (jamais deux instances par numéro,
 * sinon les sessions se détruisent). L'API existe, elle répond
 * « indisponible » plutôt que de mentir.
 */
async function createSubBot() {
  throw new Error('Sous-bot désactivé sur DJOUSSE (règle : jamais deux instances par numéro)');
}
function listSubBots() { return []; }
function killSubBot() { return false; }
module.exports = { createSubBot, listSubBots, killSubBot };
