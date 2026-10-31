'use strict';
/**
 * lib/envoi/index.js — ORCHESTRATEUR DU CONTRÔLE D'ENVOI
 * ────────────────────────────────────────────────────────────────────
 * Appelé par lib/wa-send.js, seul point d'envoi du projet (garantie G2).
 * Ordre des contrôles — aucun n'est facultatif :
 *
 *   1. type de contenu (réactions/protocole : hors budget, sans délai)
 *   2. mode dégradé (qualité)            → refus
 *   3. allowlist / consentement          → refus AVANT tout appel réseau
 *   4. palier de montée en charge        → refus
 *   5. fenêtres glissantes (s/min/h/j)   → refus
 *   6. pause consécutive à une erreur API→ refus
 *   7. délai minimum + jitter            → attente
 *
 * Chaque refus est journalisé (numéro haché), chaque issue aussi. Une
 * erreur API est classée et peut suspendre les envois.
 */

const crypto = require('node:crypto');
const cfgMod = require('./config');
const store = require('./store');
const limites = require('./limites');
const warmup = require('./warmup');
const allowlist = require('./allowlist');
const qualite = require('./qualite');
const erreurs = require('./erreurs');

function typeDeContenu(content) {
  if (!content || typeof content !== 'object') return 'autre';
  if (content.react) return 'reaction';
  if (content.delete || content.protocolMessage) return 'protocole';
  if (typeof content.text === 'string') return 'texte';
  if (content.image || content.video || content.audio || content.document || content.sticker) return 'media';
  return 'autre';
}

/* ── alertes (fichier + console, débit limité) ─────────────────────── */
let dernierAlerte = 0;

function alerter(message) {
  const maintenant = Date.now();
  if (maintenant - dernierAlerte < 60000) return; // 1 alerte/minute max
  dernierAlerte = maintenant;
  const ligne = `[${new Date(maintenant).toISOString()}] ${message}`;
  console.error(`[ENVOI][ALERTE] ${message}`);
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const cfg = cfgMod.charger();
    /* Dans data/ (avec la base), pas à la racine du dépôt : un fichier
       d'alertes ne doit jamais finir dans git. */
    const f = path.join(require('../dataDir').DATA_DIR, cfg.alertes?.fichier || 'logs/envoi-alertes.log');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, `${ligne}\n`, 'utf8');
  } catch { /* une alerte non écrite ne doit pas bloquer un envoi */ }
}

/* ── délai de rythme ───────────────────────────────────────────────── */
function delaiRythme(cfg) {
  const { delaiMinMs, jitterMinMs, jitterMaxMs } = cfg.rythme;
  const base = Math.max(0, delaiMinMs);
  const min = Math.max(0, Math.min(jitterMinMs, jitterMaxMs));
  const max = Math.max(min, jitterMaxMs);
  const jitter = min + Math.floor(Math.random() * (max - min + 1));
  return base + jitter;
}

function pauseActive(maintenant) {
  const jusqua = Number(store.etat('pause_jusqua') || 0);
  return jusqua > maintenant ? jusqua : 0;
}

function refuser({ jid, type, code, raison, correlation }) {
  store.journaliser({ jid, type, resultat: 'refus', raison: `${code}: ${raison}`, correlation });
  return { ok: false, code, raison, correlation, delaiMs: 0 };
}

/* ── point d'entrée ────────────────────────────────────────────────── */
/**
 * @param {{jid:string, contenu:any, opts?:object}} p
 * @returns {{ok:boolean, correlation:string, type:string, delaiMs:number, code?:string, raison?:string}}
 */
function avantEnvoi({ jid, contenu }) {
  const cfg = cfgMod.charger();
  const type = typeDeContenu(contenu);
  const correlation = crypto.randomUUID();

  /* Réactions, suppressions, protocole : ni budget, ni délai. */
  if (type === 'reaction' || type === 'protocole') {
    return { ok: true, correlation, type, delaiMs: 0, compter: false };
  }

  const maintenant = Date.now();

  if (!cfg.actif) {
    return { ok: true, correlation, type, delaiMs: 0, compter: true, desactive: true };
  }

  /* 2. qualité / mode dégradé */
  const q = qualite.estDegrade(cfg);
  if (q.degrade) {
    alerter(`envois suspendus — ${q.raison}`);
    return refuser({ jid, type, code: 'QUALITE_DEGRADEE', raison: q.raison, correlation });
  }

  /* 6. pause consécutive à une erreur API */
  const pause = pauseActive(maintenant);
  if (pause) {
    return refuser({
      jid, type, code: 'PAUSE_APRES_ERREUR',
      raison: `envois suspendus encore ${Math.ceil((pause - maintenant) / 1000)}s`, correlation,
    });
  }

  /* 3. allowlist — AVANT tout appel réseau, et avant les compteurs */
  const a = allowlist.verifier(jid, { mode: cfg.allowlist.mode });
  if (!a.ok) {
    alerter(`envoi refusé (${a.code}) — ${a.raison}`);
    return refuser({ jid, type, code: a.code, raison: a.raison, correlation });
  }

  /* 4. palier du jour */
  const debut = store.etat('warmup_debut') || cfg.warmup.dateDebut || null;
  if (!debut && cfg.warmup.actif) store.definirEtat('warmup_debut', String(maintenant));
  const w = warmup.evaluer({
    maintenant,
    dateDebut: debut || maintenant,
    paliers: cfg.warmup.paliers,
    envoyesJour: warmup.dejaEnvoyes(store, maintenant),
    actif: cfg.warmup.actif,
  });
  if (!w.ok) {
    alerter(`palier dépassé — ${w.raison}`);
    return refuser({ jid, type, code: w.code, raison: w.raison, correlation });
  }

  /* 5. fenêtres glissantes.
     Le plafond « par seconde » est un RYTHME, pas un budget : jeter la
     réponse parce qu'un menu vient d'être envoyé 300 ms plus tôt rend le
     bot muet. On ATTEND la fin de la fenêtre ; les plafonds minute /
     heure / jour, eux, refusent (budget journalier). */
  const { comptes, verdict } = limites.mesurer(store, maintenant, cfg.limites);
  let attenteFenetre = 0;
  if (!verdict.ok) {
    if (verdict.code === 'LIMITE_SECONDE') {
      /* Attendre la seconde ne doit jamais contourner un budget plus large :
         on revérifie minute/heure/jour en ignorant la seconde. */
      const budget = limites.evaluer({
        maintenant, comptes, limites: { ...cfg.limites, parSeconde: 0 },
      });
      if (!budget.ok) {
        alerter(`débit refusé (${budget.code}) — ${budget.raison}`);
        return refuser({ jid, type, code: budget.code, raison: budget.raison, correlation });
      }
      const dernier = store.dernierEnvoiTs();
      attenteFenetre = Math.max(0, 1000 - (maintenant - dernier)) + 5;
    } else {
      alerter(`débit refusé (${verdict.code}) — ${verdict.raison}`);
      return refuser({ jid, type, code: verdict.code, raison: verdict.raison, correlation });
    }
  }

  return { ok: true, correlation, type, delaiMs: delaiRythme(cfg) + attenteFenetre, compter: true };
}

/**
 * À appeler après l'envoi (succès ou échec). Ne lève jamais.
 * @param {{jid:string, correlation:string, type:string, succes:boolean, erreur?:any}} p
 */
function apresEnvoi({ jid, correlation, type = 'texte', succes, erreur }) {
  try {
    const cfg = cfgMod.charger();

    if (succes) {
      store.journaliser({ jid, type, resultat: 'ok', correlation });
      qualite.enregistrer({ succes: true, cfg });
      return { ok: true };
    }

    const c = erreurs.classer(erreur);
    store.journaliser({ jid, type, resultat: 'echec', raison: `${c.code}: ${c.message}`, correlation });

    if (c.pauseMs > 0) store.definirEtat('pause_jusqua', String(Date.now() + c.pauseMs));
    if (c.alerte) alerter(`erreur ${c.code} — ${c.action} — ${c.message}`);
    const etat = qualite.enregistrer({ succes: false, cfg });

    return { ok: false, code: c.code, action: c.action, retenter: c.retenter, degrade: etat.degrade };
  } catch (e) {
    console.error('[ENVOI] suivi d\'envoi impossible :', e.message);
    return { ok: false, code: 'UNKNOWN' };
  }
}

/* ── consentement (appelé sur message entrant) ─────────────────────── */
function consentir(jid, source = 'inbound') {
  try {
    const cfg = cfgMod.charger();
    if (source === 'inbound' && !cfg.allowlist.consentementAutomatique) return false;
    return allowlist.consentir(jid, source);
  } catch (e) {
    console.error('[ENVOI] consentement impossible :', e.message);
    return false;
  }
}

function revoquer(jid) {
  try { return allowlist.revoquer(jid); } catch { return false; }
}

/**
 * Consentement implicite, sans écriture inutile : un correspondant qui a
 * déjà consenti ne déclenche pas un UPSERT SQLite à chaque message.
 */
function consentirSiBesoin(jid, source = 'inbound') {
  try {
    if (allowlist.estConsenti(jid)) return false;
    return consentir(jid, source);
  } catch (e) {
    console.error('[ENVOI] consentement impossible :', e.message);
    return false;
  }
}

/**
 * Le propriétaire du bot est un cas de consentement EXPLICITE : il a
 * installé le bot et l'a appairé. Sans cela, les notifications qu'il
 * s'envoie à lui-même seraient refusées par l'allowlist.
 * @param {string[]} numeros numéros au format international (sans +)
 */
function amorcerProprietaires(numeros = []) {
  const cfg = cfgMod.charger();
  if (cfg.allowlist.mode === 'strict') return 0; // en strict, opt-in manuel uniquement
  let n = 0;
  for (const num of numeros || []) {
    const d = String(num || '').replace(/\D/g, '');
    if (d.length < 8) continue;
    if (consentirSiBesoin(`${d}@s.whatsapp.net`, 'proprietaire')) n += 1;
  }
  return n;
}

/* ── purge de rétention (1 fois par jour maximum) ──────────────────── */
function purgerSiBesoin() {
  try {
    const cfg = cfgMod.charger();
    const dernier = Number(store.etat('derniere_purge') || 0);
    if (Date.now() - dernier < 86400000) return 0;
    const n = store.purger(cfg.audit.retentionJours);
    store.definirEtat('derniere_purge', String(Date.now()));
    return n;
  } catch { return 0; }
}

/** Vue synthétique (dashboard HTTP / scripts/envoi-statut.js). */
function etatComplet() {
  const cfg = cfgMod.charger();
  const maintenant = Date.now();
  const q = qualite.score({ maintenant, fenetreJours: cfg.qualite.fenetreJours });
  const { comptes } = limites.mesurer(store, maintenant, cfg.limites);
  const debut = store.etat('warmup_debut') || cfg.warmup.dateDebut;
  const w = warmup.evaluer({
    maintenant, dateDebut: debut, paliers: cfg.warmup.paliers,
    envoyesJour: warmup.dejaEnvoyes(store, maintenant), actif: cfg.warmup.actif,
  });
  const d = qualite.estDegrade(cfg);
  return {
    actif: cfg.actif,
    degrade: d.degrade,
    degradeRaison: d.raison,
    pauseJusqua: pauseActive(maintenant) || null,
    qualite: q,
    fenetres: comptes,
    plafonds: cfg.limites,
    warmup: { actif: cfg.warmup.actif, jour: w.jour + 1, palier: w.palier, envoyesJour: w.envoyesJour },
    allowlist: { mode: cfg.allowlist.mode, consentements: store.compterConsentements() },
    audit: { chaine: store.verifierChaine(), dernier: store.derniersEnvois(1)[0] || null },
  };
}

module.exports = {
  avantEnvoi, apresEnvoi, consentir, consentirSiBesoin, amorcerProprietaires, revoquer,
  etatComplet, alerter, purgerSiBesoin, typeDeContenu,
  /* exposés pour les tests et les scripts */
  store, limites, warmup, allowlist, qualite, erreurs, config: cfgMod,
};
