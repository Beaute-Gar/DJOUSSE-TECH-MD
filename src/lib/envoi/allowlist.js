'use strict';
/**
 * lib/envoi/allowlist.js — consentement vérifié AVANT tout appel réseau
 * ────────────────────────────────────────────────────────────────────
 * Deux modes (src/config/envoi.json → allowlist.mode) :
 *
 *   « reponse » (défaut) : un correspondant qui a écrit au bot est consenti
 *        automatiquement, avec horodatage (handler.js → envoi.consentir).
 *        C'est le consentement implicite : la personne a ouvert la
 *        conversation. Les envois PROACTIFS vers un inconnu restent refusés.
 *
 *   « strict » : seul un opt-in explicite (commande owner, migration)
 *        autorise l'envoi — même pour répondre.
 *
 * Dans les deux cas, le refus intervient avant toute construction de
 * message ou d'appel socket : le numéro non autorisé n'existe pour le
 * bot que sous forme de HMAC dans le journal.
 */

const store = require('./store');

/** Numéro normalisé : « 2376…:12@s.whatsapp.net » → « 2376…@s.whatsapp.net ». */
function normaliser(jid) {
  const j = String(jid || '').trim().toLowerCase();
  if (!j) return '';
  return j.replace(/:\d+@/, '@');
}

const estGroupe = (jid) => normaliser(jid).endsWith('@g.us');
const estStatut = (jid) => normaliser(jid) === 'status@broadcast';

/** Autorise explicitement un numéro (opt-in horodaté). */
function consentir(jid, source = 'manuel') {
  const j = normaliser(jid);
  if (!j) return false;
  store.consentir(j, source);
  return true;
}

/** Révoque le consentement — l'historique d'audit reste intact. */
function revoquer(jid) {
  return store.revoquer(normaliser(jid));
}

function estConsenti(jid, opts = {}) {
  return store.estConsenti(normaliser(jid), opts);
}

/**
 * @returns {{ok:boolean, code?:string, raison?:string}}
 */
function verifier(jid, { mode = 'reponse' } = {}) {
  const j = normaliser(jid);
  if (!j) return { ok: false, code: 'NON_AUTORISE', raison: 'destinataire vide' };

  /* Le statut WhatsApp du propriétaire n'a pas de « correspondant ». */
  if (estStatut(j)) return { ok: true };

  const strict = mode === 'strict';
  if (estConsenti(j, { expliciteSeulement: strict })) return { ok: true };

  /* En strict, un consentement implicite existe mais ne suffit pas : le
     dire explicitement évite de faire croire à un numéro inconnu. */
  const implicite = strict && estConsenti(j);

  return {
    ok: false,
    code: 'NON_AUTORISE',
    raison: implicite
      ? 'consentement implicite refusé en mode strict : opt-in explicite requis'
      : strict
        ? `destinataire non autorisé (mode strict) : ${estGroupe(j) ? 'groupe' : 'numéro'} absent de l'allowlist`
        : 'aucun consentement enregistré : ce numéro n’a jamais écrit au bot',
  };
}

module.exports = { normaliser, estGroupe, estStatut, consentir, revoquer, estConsenti, verifier };
