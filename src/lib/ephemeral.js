'use strict';
/**
 * Durées de messages éphémères — source unique (secondes, protocole WA).
 * Utilisé par .disappear (handler.js) et .community ephemeral (lib/extras.js).
 */

const EPHEMERAL_SECONDS = {
  off: 0, '0': 0, disable: 0,
  '24h': 86400, '1d': 86400, jour: 86400,
  '7d': 604800, '7j': 604800, semaine: 604800,
  '90d': 7776000, '90j': 7776000,
};

/** @returns {number|null} secondes, ou null si l'argument est inconnu */
function parseEphemeral(arg) {
  const key = String(arg || '').toLowerCase();
  return key in EPHEMERAL_SECONDS ? EPHEMERAL_SECONDS[key] : null;
}

module.exports = { EPHEMERAL_SECONDS, parseEphemeral };
