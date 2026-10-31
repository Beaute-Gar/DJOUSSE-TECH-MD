'use strict';
/**
 * lib/envoi/config.js — réglages du contrôle d'envoi
 * ────────────────────────────────────────────────────────────────────
 * Source de vérité : src/config/envoi.json (modifiable SANS redéploiement).
 * Le fichier est relu automatiquement quand sa date de modification change :
 * un `fly deploy` n'est pas nécessaire pour changer un plafond.
 *
 * Surcharges d'urgence par variables d'environnement (prioritaires) :
 *   ENVOI_ACTIF=0            coupe le contrôle (journalisé comme tel)
 *   ENVOI_MODE=strict|reponse
 *   ENVOI_MAX_SECONDE / _MINUTE / _HEURE / _JOUR
 *   ENVOI_DELAI_MIN / ENVOI_JITTER_MAX
 *   ENVOI_WARMUP=0           désactive le plan de montée en charge
 *   ENVOI_DEGRADE=1          force le mode dégradé (arrêt des envois)
 *   ENVOI_SEL=...            sel HMAC des numéros (sinon généré + persisté)
 *
 * Aucune exception n'est levée : un JSON invalide retombe sur les valeurs
 * par défaut et laisse une trace. Un bot doit démarrer même mal configuré,
 * mais il doit le dire.
 */

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = path.join(__dirname, '..', '..', 'config', 'envoi.json');

const DEFAUTS = {
  actif: true,
  rythme: { delaiMinMs: 350, jitterMinMs: 0, jitterMaxMs: 3000, pauseApresPanneMs: 30000 },
  limites: { parSeconde: 1, parMinute: 20, parHeure: 200, parJour: 500 },
  warmup: { actif: true, dateDebut: null, paliers: [50, 80, 120, 160, 200, 250, 300, 350, 400, 450, 500, 500, 500, 500] },
  qualite: { fenetreJours: 7, seuilAlerte: 60, seuilDegrade: 40, echecsConsecutifsMax: 5 },
  allowlist: { mode: 'reponse', consentementAutomatique: true },
  approbation: { seuilCampagne: 50 },
  alertes: { refusParMinute: 5, fichier: 'logs/envoi-alertes.log' },
  audit: { retentionJours: 180 },
};

const nombre = (v, defaut) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

function fusion(base, sur) {
  if (!sur || typeof sur !== 'object' || Array.isArray(sur)) return base;
  const out = { ...base };
  for (const [cle, valeur] of Object.entries(sur)) {
    out[cle] = valeur && typeof valeur === 'object' && !Array.isArray(valeur) && base[cle] && typeof base[cle] === 'object'
      ? fusion(base[cle], valeur)
      : valeur;
  }
  return out;
}

function normaliser(brut) {
  const c = fusion(DEFAUTS, brut);

  c.actif = c.actif !== false;
  c.rythme.delaiMinMs = nombre(c.rythme.delaiMinMs, DEFAUTS.rythme.delaiMinMs);
  c.rythme.jitterMinMs = nombre(c.rythme.jitterMinMs, 0);
  c.rythme.jitterMaxMs = Math.max(c.rythme.jitterMinMs, nombre(c.rythme.jitterMaxMs, 0));
  c.rythme.pauseApresPanneMs = nombre(c.rythme.pauseApresPanneMs, DEFAUTS.rythme.pauseApresPanneMs);

  for (const cle of ['parSeconde', 'parMinute', 'parHeure', 'parJour']) {
    c.limites[cle] = Math.floor(nombre(c.limites[cle], DEFAUTS.limites[cle]));
  }
  /* 0 = plafond désactivé (explicite), pas une limite de zéro message */
  c.limites.parSeconde = Math.max(1, c.limites.parSeconde);

  c.warmup.actif = c.warmup.actif !== false;
  c.warmup.paliers = (Array.isArray(c.warmup.paliers) ? c.warmup.paliers : DEFAUTS.warmup.paliers)
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!c.warmup.paliers.length) c.warmup.paliers = [...DEFAUTS.warmup.paliers];

  c.qualite.fenetreJours = Math.max(1, Math.floor(nombre(c.qualite.fenetreJours, 7)));
  c.qualite.seuilAlerte = Math.min(100, nombre(c.qualite.seuilAlerte, 60));
  c.qualite.seuilDegrade = Math.min(c.qualite.seuilAlerte, nombre(c.qualite.seuilDegrade, 40));
  c.qualite.echecsConsecutifsMax = Math.max(1, Math.floor(nombre(c.qualite.echecsConsecutifsMax, 5)));

  c.allowlist.mode = c.allowlist.mode === 'strict' ? 'strict' : 'reponse';
  c.allowlist.consentementAutomatique = c.allowlist.consentementAutomatique !== false;
  c.approbation.seuilCampagne = Math.max(1, Math.floor(nombre(c.approbation.seuilCampagne, 50)));
  c.audit.retentionJours = Math.max(7, Math.floor(nombre(c.audit.retentionJours, 180)));

  /* ── surcharges .env (urgence, priment sur le fichier) ── */
  if (process.env.ENVOI_ACTIF === '0' || process.env.ENVOI_ACTIF === 'false') c.actif = false;
  if (process.env.ENVOI_MODE === 'strict') c.allowlist.mode = 'strict';
  if (process.env.ENVOI_MODE === 'reponse') c.allowlist.mode = 'reponse';
  if (process.env.ENVOI_WARMUP === '0') c.warmup.actif = false;
  if (process.env.ENVOI_DEGRADE === '1') c.forcerDegrade = true;
  c.limites.parMinute = Math.floor(nombre(process.env.ENVOI_MAX_MINUTE, c.limites.parMinute));
  c.limites.parHeure = Math.floor(nombre(process.env.ENVOI_MAX_HEURE, c.limites.parHeure));
  c.limites.parJour = Math.floor(nombre(process.env.ENVOI_MAX_JOUR, c.limites.parJour));
  if (process.env.ENVOI_DELAI_MIN !== undefined) c.rythme.delaiMinMs = nombre(process.env.ENVOI_DELAI_MIN, c.rythme.delaiMinMs);
  if (process.env.ENVOI_JITTER_MAX !== undefined) c.rythme.jitterMaxMs = nombre(process.env.ENVOI_JITTER_MAX, c.rythme.jitterMaxMs);

  return c;
}

let cache = null;
let mtime = -1;

/** Réglages courants (relecture automatique si le fichier change). */
function charger() {
  let m = 0;
  try { m = fs.statSync(FICHIER).mtimeMs; } catch { /* fichier absent → défauts */ }
  if (cache && m === mtime) return cache;

  let brut = null;
  if (m) {
    try { brut = JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch (e) {
      console.error('[ENVOI] envoi.json invalide, valeurs par défaut :', e.message);
    }
  }
  cache = normaliser(brut);
  mtime = m;
  return cache;
}

/** Recharge de force (tests, ou après écriture du fichier). */
function recharger() { cache = null; mtime = -1; return charger(); }

module.exports = { charger, recharger, DEFAUTS, FICHIER };
