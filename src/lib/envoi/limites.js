'use strict';
/**
 * lib/envoi/limites.js — pare-feu à fenêtre glissante
 * ────────────────────────────────────────────────────────────────────
 * Quatre niveaux, tous obligatoires : seconde → minute → heure → jour.
 * Le premier dépassement rencontré refuse l'envoi. Aucun envoi ne peut
 * contourner ce module : il est appelé par lib/envoi/index.js, lui-même
 * appelé par lib/wa-send.js, seul fichier autorisé à envoyer (garantie G2).
 *
 * Fonctions pures (testables sans base) + un adaptateur qui interroge
 * le journal SQLite.
 */

const FENETRES = [
  { cle: 'parSeconde', ms: 1000, code: 'LIMITE_SECONDE' },
  { cle: 'parMinute', ms: 60000, code: 'LIMITE_MINUTE' },
  { cle: 'parHeure', ms: 3600000, code: 'LIMITE_HEURE' },
  { cle: 'parJour', ms: 86400000, code: 'LIMITE_JOUR' },
];

/**
 * @param {{maintenant:number, comptes:object, limites:object}} p
 * @returns {{ok:boolean, code?:string, raison?:string, retryAfterMs?:number, fenetre?:string}}
 */
function evaluer({ maintenant, comptes, limites }) {
  for (const f of FENETRES) {
    const plafond = Number(limites?.[f.cle]);
    if (!Number.isFinite(plafond) || plafond <= 0) continue; // 0 = plafond coupé volontairement
    const utilise = Number(comptes?.[f.cle] || 0);
    if (utilise >= plafond) {
      return {
        ok: false,
        code: f.code,
        fenetre: f.cle,
        raison: `${utilise}/${plafond} messages sur la dernière ${libelle(f.ms)}`,
        retryAfterMs: f.ms,
      };
    }
  }
  return { ok: true };
}

function libelle(ms) {
  if (ms === 1000) return 'seconde';
  if (ms === 60000) return 'minute';
  if (ms === 3600000) return 'heure';
  return 'journée';
}

/** Bornes de chaque fenêtre à l'instant donné. */
function bornes(maintenant) {
  const out = {};
  for (const f of FENETRES) out[f.cle] = maintenant - f.ms;
  return out;
}

/** Compte réel depuis le journal d'audit. */
function mesurer(store, maintenant, limites) {
  const comptes = {};
  for (const f of FENETRES) comptes[f.cle] = store.compterDepuis(maintenant - f.ms, maintenant);
  return { comptes, verdict: evaluer({ maintenant, comptes, limites }) };
}

module.exports = { FENETRES, evaluer, mesurer, bornes };
