'use strict';
/**
 * lib/envoi/qualite.js — note de santé du numéro (PROXY LOCAL)
 * ────────────────────────────────────────────────────────────────────
 * ⚠️ Ce n'est PAS le « Quality Rating » officiel de WhatsApp : celui-ci
 * n'existe que pour un WABA via le Graph API. Avec Baileys, on n'y a pas
 * accès. On calcule donc un indice équivalent à partir de ce qu'on
 * observe réellement : succès, échecs, refus, sur une fenêtre glissante
 * de 7 jours. Il est documenté comme proxy partout où il est affiché.
 *
 *   score = 100 × succès / (succès + échecs)      (100 si aucun envoi)
 *
 * Le passage en mode dégradé (envois suspendus) se déclenche :
 *   • score < qualite.seuilDegrade, ou
 *   • qualite.echecsConsecutifsMax échecs d'affilée, ou
 *   • ENVOI_DEGRADE=1 (arrêt manuel d'urgence).
 */

const store = require('./store');

const JOUR = 86400000;

function score({ maintenant = Date.now(), fenetreJours = 7 } = {}) {
  const depuis = maintenant - fenetreJours * JOUR;
  const b = store.bilanDepuis(depuis);
  const tentatives = b.ok + b.echec;
  const valeur = tentatives ? Math.round((100 * b.ok) / tentatives) : 100;
  return {
    source: 'proxy-local',
    score: valeur,
    sur: 100,
    ok: b.ok,
    echec: b.echec,
    refus: b.refus,
    tentatives,
    fenetreJours,
    depuis,
  };
}

/** État dégradé persistant (survit au redémarrage). */
function estDegrade(cfg = {}) {
  if (cfg.forcerDegrade) return { degrade: true, raison: 'ENVOI_DEGRADE=1 (arrêt manuel)' };
  if (store.etat('degrade') !== '1') return { degrade: false, raison: null };
  return { degrade: true, raison: store.etat('degrade_raison') || 'seuil de qualité franchi' };
}

function basculerDegrade(raison = 'seuil de qualité franchi') {
  store.definirEtat('degrade', '1');
  store.definirEtat('degrade_raison', raison);
  store.definirEtat('degrade_depuis', String(Date.now()));
  return raison;
}

function retablir() {
  store.definirEtat('degrade', '0');
  store.definirEtat('degrade_raison', '');
  store.definirEtat('echecs_consecutifs', '0');
}

/** Échecs d'affilée (compteur persistant). */
function echecsConsecutifs() {
  return Number(store.etat('echecs_consecutifs') || 0);
}

/**
 * Enregistre l'issue d'un envoi et applique les seuils.
 * @param {{succes:boolean, cfg:object, maintenant?:number}} p
 * @returns {{degrade:boolean, score:number, echecsConsecutifs:number, alerte:boolean}}
 */
function enregistrer({ succes, cfg = {}, maintenant = Date.now() }) {
  const q = cfg.qualite || {};
  const fenetreJours = q.fenetreJours || 7;

  let suite = succes ? 0 : echecsConsecutifs() + 1;
  store.definirEtat('echecs_consecutifs', String(suite));

  const s = score({ maintenant, fenetreJours });
  const seuilDegrade = Number(q.seuilDegrade ?? 40);
  const seuilAlerte = Number(q.seuilAlerte ?? 60);
  const maxSuite = Number(q.echecsConsecutifsMax ?? 5);

  let degrade = false;
  if (s.score < seuilDegrade) {
    basculerDegrade(`score ${s.score}/100 < seuil ${seuilDegrade}`);
    degrade = true;
  } else if (suite >= maxSuite) {
    basculerDegrade(`${suite} échecs consécutifs (max ${maxSuite})`);
    degrade = true;
  }

  return {
    degrade,
    score: s.score,
    echecsConsecutifs: suite,
    alerte: degrade || s.score < seuilAlerte || suite >= Math.ceil(maxSuite / 2),
  };
}

module.exports = { score, estDegrade, basculerDegrade, retablir, echecsConsecutifs, enregistrer };
