'use strict';
/**
 * lib/envoi/warmup.js — montée en charge progressive (14 jours)
 * ────────────────────────────────────────────────────────────────────
 * Un numéro neuf qui envoie 500 messages le premier jour se fait limiter.
 * Le plan est une LISTE DE PALIERS dans src/config/envoi.json : un chiffre
 * par jour, modifiable sans redéploiement.
 *
 * Le dépassement du palier du jour est REFUSÉ, avec un message explicite
 * dans le journal d'audit (`warmup:palier-depasse`). Ce module ne décide
 * jamais seul d'augmenter un plafond : il lit le plan.
 */

const JOUR_MS = 86400000;

/** Minuit local d'un instant (les paliers sont journaliers, pas glissants). */
function debutDeJour(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Index du jour du plan (0 = premier jour). `dateDebut` accepte un
 * timestamp ou une chaîne ISO. Renvoie -1 si la date de début est future.
 */
function jourIndex(dateDebut, maintenant = Date.now()) {
  if (!dateDebut) return 0;
  const debut = new Date(dateDebut).getTime();
  if (!Number.isFinite(debut)) return 0;
  return Math.floor((debutDeJour(maintenant) - debutDeJour(debut)) / JOUR_MS);
}

/** Plafond du jour : le dernier palier se répète après la fin du plan. */
function palierPour(jour, paliers = []) {
  const plan = Array.isArray(paliers) ? paliers.filter((n) => Number.isFinite(n)) : [];
  if (!plan.length) return Infinity;
  const i = Math.min(Math.max(0, Math.floor(jour)), plan.length - 1);
  return plan[i];
}

/**
 * @param {{maintenant?:number, dateDebut?:any, paliers?:number[], envoyesJour?:number, actif?:boolean}} p
 * @returns {{ok:boolean, jour:number, palier:number, envoyesJour:number, raison?:string, code?:string}}
 */
function evaluer({ maintenant = Date.now(), dateDebut = null, paliers = [], envoyesJour = 0, actif = true } = {}) {
  if (!actif) return { ok: true, jour: 0, palier: Infinity, envoyesJour };

  const jour = jourIndex(dateDebut, maintenant);
  if (jour < 0) {
    return {
      ok: false, code: 'WARMUP_PAS_COMMENCE', jour, palier: 0, envoyesJour,
      raison: `plan de montée en charge prévu le ${new Date(dateDebut).toISOString()}`,
    };
  }
  const palier = palierPour(jour, paliers);
  if (envoyesJour >= palier) {
    return {
      ok: false, code: 'WARMUP_PALIER_DEPASSE', jour, palier, envoyesJour,
      raison: `palier jour ${jour + 1} atteint : ${envoyesJour}/${palier} messages`,
    };
  }
  return { ok: true, jour, palier, envoyesJour };
}

/** Nombre d'envois déjà faits aujourd'hui (journal réel). */
function dejaEnvoyes(store, maintenant = Date.now()) {
  return store.compterDepuis(debutDeJour(maintenant), maintenant);
}

module.exports = { JOUR_MS, debutDeJour, jourIndex, palierPour, evaluer, dejaEnvoyes };
