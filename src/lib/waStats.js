'use strict';
/**
 * lib/waStats.js — statistiques de connexion WhatsApp partagées
 *
 *   index.js (producteur) ──écrit──▶ ce module ──lit──▶ handler.js (.diag)
 *
 * Sans ce pont, handler.js ne peut pas voir ce qui se passe au niveau
 * socket : il n'a ni conflictCount ni le dernier code de déconnexion.
 * Module volontairement vide d'import lourd pour être requirable des
 * deux côtés sans cycle d'import ni coût de démarrage.
 */
module.exports = {
  /* dernière déconnexion */
  lastDisconnectCode: null,
  lastDisconnectAt: 0,
  lastDisconnectMsg: '',
  /* escalier anti-conflit (440 connectionReplaced) */
  conflicts: 0,
  handshakeFails: 0,
  /* pairing */
  pairingAttempts: 0,
  lastPairingCodeAt: 0,
  /* cycle de vie */
  connects: 0,
  connectedSince: 0,
  /* version WA réellement négociée */
  waVersion: null,
  waVersionSource: '',
  /* démarrage du process (diagnostic uptime socket vs process) */
  startedAt: Date.now(),
};
