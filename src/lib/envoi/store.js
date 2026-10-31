'use strict';
/**
 * lib/envoi/store.js — persistance du contrôle d'envoi
 * ────────────────────────────────────────────────────────────────────
 * Toutes les tables vivent dans la base déjà utilisée par le bot
 * (data/bot.db, SQLite via node:sqlite, voir lib/db.js). Pourquoi ici et
 * pas dans MongoDB Atlas : le journal d'audit doit rester inscriptible
 * même si la base distante des sessions est injoignable. Un audit qui
 * perd des lignes quand le réseau tombe ne prouve rien.
 *
 *   envoi_consentement  opt-in horodaté — NUMÉROS JAMAIS STOCKÉS EN CLAIR
 *                       (seulement un HMAC-SHA256 du jid)
 *   envoi_journal       journal chaîné (empreinte_prec → empreinte)
 *   envoi_etat          sel HMAC, drapeau dégradé, compteurs de panne
 *
 * Repli mémoire si node:sqlite est absent (Node < 22.5) : le bot continue
 * de fonctionner, mais l'audit n'est plus durable — signalé au démarrage.
 */

const crypto = require('node:crypto');
const db = require('../db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS envoi_consentement (
  jid_hash   TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  cree_le    INTEGER NOT NULL,
  revoque_le INTEGER
);
CREATE TABLE IF NOT EXISTS envoi_journal (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             INTEGER NOT NULL,
  jid_hash       TEXT NOT NULL,
  type           TEXT NOT NULL,
  resultat       TEXT NOT NULL,
  raison         TEXT,
  correlation    TEXT,
  empreinte      TEXT NOT NULL,
  empreinte_prec TEXT
);
CREATE INDEX IF NOT EXISTS idx_envoi_journal_ts  ON envoi_journal(ts);
CREATE INDEX IF NOT EXISTS idx_envoi_journal_jid ON envoi_journal(jid_hash, ts);
CREATE TABLE IF NOT EXISTS envoi_etat (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
`;

/* ── repli mémoire ─────────────────────────────────────────────────── */
const mem = {
  consentement: new Map(), // hash → { source, cree_le, revoque_le }
  journal: [],
  etat: new Map(),
};

let pret = false;
function assurer() {
  if (pret) return;
  pret = true;
  if (!db.available()) {
    console.error('[ENVOI] node:sqlite indisponible — journal d\'audit EN MÉMOIRE (non durable).');
    return;
  }
  try { db.conn().exec(SCHEMA); } catch (e) {
    console.error('[ENVOI] schéma impossible :', e.message);
  }
}

const persistant = () => db.available();

/* ── sel HMAC ──────────────────────────────────────────────────────── */
function etat(cle) {
  assurer();
  if (!persistant()) return mem.etat.get(cle) ?? null;
  try {
    const r = db.conn().prepare('SELECT valeur FROM envoi_etat WHERE cle = ?').get(cle);
    return r ? r.valeur : null;
  } catch { return null; }
}

function definirEtat(cle, valeur) {
  assurer();
  const v = valeur == null ? '' : String(valeur);
  if (!persistant()) { mem.etat.set(cle, v); return v; }
  try {
    db.conn()
      .prepare('INSERT INTO envoi_etat(cle, valeur) VALUES(?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur')
      .run(cle, v);
  } catch (e) { console.error('[ENVOI] état non écrit :', e.message); }
  return v;
}

/**
 * Sel de hachage des numéros. `ENVOI_SEL` dans .env est recommandé : sans
 * lui, le sel est généré puis persisté, donc un vol de bot.db permettrait
 * de recalculer les numéros par force brute (10^9 candidats, faisable).
 */
function sel() {
  const env = String(process.env.ENVOI_SEL || '').trim();
  if (env) return env;
  let s = etat('sel');
  if (!s) { s = crypto.randomBytes(32).toString('hex'); definirEtat('sel', s); }
  return s;
}

/** Empreinte stable d'un jid — jamais réversible sans le sel. */
function hacher(jid) {
  return crypto.createHmac('sha256', sel()).update(String(jid || '')).digest('hex');
}

/** « 2376…:12@s.whatsapp.net » et « 2376…@s.whatsapp.net » → même empreinte. */
function normaliserJid(jid) {
  return String(jid || '').trim().toLowerCase().replace(/:\d+@/, '@');
}

/* ── consentement (allowlist) ──────────────────────────────────────── */
function consentir(jid, source = 'inconnu') {
  assurer();
  const h = hacher(jid);
  const maintenant = Date.now();
  if (!persistant()) {
    const ancien = mem.consentement.get(h);
    mem.consentement.set(h, { source, cree_le: ancien?.cree_le || maintenant, revoque_le: null });
    return h;
  }
  try {
    db.conn().prepare(`
      INSERT INTO envoi_consentement(jid_hash, source, cree_le, revoque_le)
      VALUES(?, ?, ?, NULL)
      ON CONFLICT(jid_hash) DO UPDATE SET revoque_le = NULL
    `).run(h, String(source), maintenant);
  } catch (e) { console.error('[ENVOI] consentement non écrit :', e.message); }
  return h;
}

function revoquer(jid) {
  assurer();
  const h = hacher(jid);
  const maintenant = Date.now();
  if (!persistant()) {
    const ancien = mem.consentement.get(h);
    if (ancien) mem.consentement.set(h, { ...ancien, revoque_le: maintenant });
    return !!ancien;
  }
  try {
    const r = db.conn().prepare('UPDATE envoi_consentement SET revoque_le = ? WHERE jid_hash = ?').run(maintenant, h);
    return r.changes > 0;
  } catch { return false; }
}

function estConsenti(jid, { expliciteSeulement = false } = {}) {
  assurer();
  const h = hacher(normaliserJid(jid));
  if (!persistant()) {
    const c = mem.consentement.get(h);
    if (!c || c.revoque_le) return false;
    return !(expliciteSeulement && /^inbound/i.test(c.source || ''));
  }
  try {
    const r = db.conn().prepare('SELECT source, revoque_le FROM envoi_consentement WHERE jid_hash = ?').get(h);
    if (!r || r.revoque_le) return false;
    /* Mode strict : un consentement IMPLICITE (le contact a écrit au bot)
       ne suffit pas. Seul un opt-in explicite (owner, migration) compte. */
    return !(expliciteSeulement && /^inbound/i.test(r.source || ''));
  } catch { return false; }
}

/** Liste SANS numéros : impossible de reconstruire l'allowlist depuis ici. */
function listeConsentements(limite = 200) {
  assurer();
  const n = Math.max(1, Math.min(1000, Number(limite) || 200));
  if (!persistant()) {
    return [...mem.consentement.entries()].slice(0, n)
      .map(([h, c]) => ({ jid_hash: h, source: c.source, cree_le: c.cree_le, revoque_le: c.revoque_le }));
  }
  try {
    return db.conn().prepare(
      'SELECT jid_hash, source, cree_le, revoque_le FROM envoi_consentement ORDER BY cree_le DESC LIMIT ?',
    ).all(n);
  } catch { return []; }
}

/** Nombre de consentements actifs (sans exposer les numéros). */
function compterConsentements() {
  assurer();
  if (!persistant()) {
    return [...mem.consentement.values()].filter((c) => !c.revoque_le).length;
  }
  try {
    return db.conn().prepare('SELECT COUNT(*) AS n FROM envoi_consentement WHERE revoque_le IS NULL').get().n;
  } catch { return 0; }
}

/* ── journal chaîné ────────────────────────────────────────────────── */
function empreinte({ empreintePrec, ts, jidHash, type, resultat, raison, correlation }) {
  return crypto.createHash('sha256')
    .update([empreintePrec || '', ts, jidHash, type, resultat, raison || '', correlation || ''].join('|'))
    .digest('hex');
}

function derniereEmpreinte() {
  if (!persistant()) return mem.journal.length ? mem.journal[mem.journal.length - 1].empreinte : null;
  try {
    const r = db.conn().prepare('SELECT empreinte FROM envoi_journal ORDER BY id DESC LIMIT 1').get();
    return r ? r.empreinte : null;
  } catch { return null; }
}

/**
 * @param {{jid:string, type:string, resultat:string, raison?:string, correlation?:string, ts?:number}} e
 * @returns {{empreinte:string, empreintePrec:string|null}}
 */
function journaliser(e) {
  assurer();
  const ts = Number(e.ts) || Date.now();
  const jidHash = hacher(normaliserJid(e.jid));
  const type = String(e.type || 'texte');
  const resultat = String(e.resultat || 'inconnu');
  const raison = e.raison ? String(e.raison).slice(0, 300) : null;
  const correlation = e.correlation || null;
  const empreintePrec = derniereEmpreinte();
  const h = empreinte({ empreintePrec, ts, jidHash, type, resultat, raison, correlation });

  const ligne = { ts, jid_hash: jidHash, type, resultat, raison, correlation, empreinte: h, empreinte_prec: empreintePrec };

  if (!persistant()) { mem.journal.push(ligne); return { empreinte: h, empreintePrec }; }
  try {
    db.conn().prepare(`
      INSERT INTO envoi_journal(ts, jid_hash, type, resultat, raison, correlation, empreinte, empreinte_prec)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ts, jidHash, type, resultat, raison, correlation, h, empreintePrec);
  } catch (err) { console.error('[ENVOI] audit non écrit :', err.message); }
  return { empreinte: h, empreintePrec };
}

function derniersEnvois(limite = 50) {
  assurer();
  const n = Math.max(1, Math.min(500, Number(limite) || 50));
  if (!persistant()) return mem.journal.slice(-n).reverse();
  try {
    return db.conn().prepare(
      'SELECT ts, jid_hash, type, resultat, raison, correlation, empreinte FROM envoi_journal ORDER BY id DESC LIMIT ?',
    ).all(n);
  } catch { return []; }
}

/** Tout l'historique d'un numéro, reconstitué à partir de son empreinte. */
function historique(jidOuHash, limite = 200) {
  assurer();
  const brut = String(jidOuHash);
  const h = /^[a-f0-9]{64}$/i.test(brut) ? brut : hacher(normaliserJid(brut));
  const n = Math.max(1, Math.min(1000, Number(limite) || 200));
  if (!persistant()) {
    return mem.journal.filter((l) => l.jid_hash === h).slice(-n)
      .map((l) => ({ ts: l.ts, type: l.type, resultat: l.resultat, raison: l.raison, correlation: l.correlation, empreinte: l.empreinte }));
  }
  try {
    return db.conn().prepare(
      'SELECT ts, type, resultat, raison, correlation, empreinte FROM envoi_journal WHERE jid_hash = ? ORDER BY id DESC LIMIT ?',
    ).all(h, n);
  } catch { return []; }
}

/** Comptage dans une fenêtre [depuis, jusqua] — par défaut les envois réels. */
function compterDepuis(depuis, jusqua = Date.now(), { inclureRefus = false } = {}) {
  assurer();
  const filtre = inclureRefus ? '' : " AND resultat <> 'refus'";
  if (!persistant()) {
    return mem.journal.filter((l) => l.ts >= depuis && l.ts <= jusqua
      && (inclureRefus || l.resultat !== 'refus')).length;
  }
  try {
    return db.conn().prepare(
      `SELECT COUNT(*) AS n FROM envoi_journal WHERE ts >= ? AND ts <= ?${filtre}`,
    ).get(depuis, jusqua).n;
  } catch { return 0; }
}

/** Horodatage du dernier envoi RÉEL (les refus ne consomment pas de budget). */
function dernierEnvoiTs() {
  assurer();
  if (!persistant()) {
    for (let i = mem.journal.length - 1; i >= 0; i -= 1) {
      if (mem.journal[i].resultat !== 'refus') return mem.journal[i].ts;
    }
    return 0;
  }
  try {
    const r = db.conn().prepare(
      "SELECT ts FROM envoi_journal WHERE resultat <> 'refus' ORDER BY id DESC LIMIT 1",
    ).get();
    return r ? r.ts : 0;
  } catch { return 0; }
}

/** Répartition succès / échecs sur une fenêtre. */
function bilanDepuis(depuis) {
  assurer();
  if (!persistant()) {
    const rows = mem.journal.filter((l) => l.ts >= depuis);
    return {
      ok: rows.filter((r) => r.resultat === 'ok').length,
      echec: rows.filter((r) => r.resultat === 'echec').length,
      refus: rows.filter((r) => r.resultat === 'refus').length,
      total: rows.length,
    };
  }
  try {
    const r = db.conn().prepare(`
      SELECT
        SUM(CASE WHEN resultat = 'ok'    THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN resultat = 'echec' THEN 1 ELSE 0 END) AS echec,
        SUM(CASE WHEN resultat = 'refus' THEN 1 ELSE 0 END) AS refus,
        COUNT(*) AS total
      FROM envoi_journal WHERE ts >= ?
    `).get(depuis);
    return { ok: r.ok || 0, echec: r.echec || 0, refus: r.refus || 0, total: r.total || 0 };
  } catch { return { ok: 0, echec: 0, refus: 0, total: 0 }; }
}

/**
 * Vérifie l'intégrité de la chaîne : toute ligne modifiée ou supprimée
 * rompt le calcul. C'est ce qui rend le journal « immuable » en pratique.
 */
function verifierChaine(limite = 5000) {
  assurer();
  const lignes = persistant()
    ? (() => { try {
      return db.conn().prepare(
        'SELECT ts, jid_hash, type, resultat, raison, correlation, empreinte, empreinte_prec FROM envoi_journal ORDER BY id ASC LIMIT ?',
      ).all(Math.max(1, Number(limite) || 5000));
    } catch { return []; } })()
    : mem.journal;

  let prec = null;
  for (const l of lignes) {
    const attendu = empreinte({
      empreintePrec: l.empreinte_prec,
      ts: l.ts, jidHash: l.jid_hash, type: l.type,
      resultat: l.resultat, raison: l.raison, correlation: l.correlation,
    });
    if (l.empreinte_prec !== prec && lignes.length > 1) {
      return { ok: false, lignes: lignes.length, rupture: l.ts, motif: 'chaînage rompu (empreinte_prec)' };
    }
    if (attendu !== l.empreinte) {
      return { ok: false, lignes: lignes.length, rupture: l.ts, motif: 'empreinte recalculée différente' };
    }
    prec = l.empreinte;
  }
  return { ok: true, lignes: lignes.length, rupture: null };
}

function purger(jours) {
  assurer();
  const d = Math.max(1, Number(jours) || 180);
  const avant = Date.now() - d * 86400000;
  if (!persistant()) {
    const n = mem.journal.length;
    mem.journal = mem.journal.filter((l) => l.ts >= avant);
    return n - mem.journal.length;
  }
  try {
    return db.conn().prepare('DELETE FROM envoi_journal WHERE ts < ?').run(avant).changes;
  } catch { return 0; }
}

module.exports = {
  assurer, persistant, hacher, sel,
  consentir, revoquer, estConsenti, listeConsentements, compterConsentements,
  journaliser, derniersEnvois, historique, compterDepuis, dernierEnvoiTs, bilanDepuis, verifierChaine, purger,
  etat, definirEtat,
};
