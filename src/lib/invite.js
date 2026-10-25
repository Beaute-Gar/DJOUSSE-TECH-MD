'use strict';
/**
 * Extraction du code d'invitation WhatsApp depuis un lien ou un code brut.
 * Utilisé par .inviteinfo (lib/missing.js) et
 * .community join|inviteinfo (lib/extras.js).
 */

/** @returns {string|null} code d'invitation, ou null si invalide */
function extractInviteCode(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{8,}$/.test(text) ? text : null;
}

module.exports = { extractInviteCode };
