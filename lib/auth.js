'use strict';
/**
 * lib/auth.js — MODULE 1 : SÉCURITÉ DE L'AUTHENTIFICATION & CONTRÔLE D'ACCÈS
 * ────────────────────────────────────────────────────────────────────────
 * Politique STRICTE (cahier des charges) : une commande ne s'exécute que
 * si l'utilisateur est :
 *
 *   • le OWNER   — OWNER_NUMBER (.env), comparaison EXACTE après
 *                  normalisation, JAMAIS endsWith ;
 *   • un SUDO    — co-owner (SUDO_NUMBER + state.settings.sudo) : même
 *                  niveau de confiance accordé par le owner, il fait
 *                  partie des « acceptés » de droit ;
 *   • ACCEPTED   — liste gérée par la commande .accept, permanent OU
 *                  avec expiration (30m / 24h / 7d …).
 *
 * POURQUOI JAMAIS endsWith (faille corrigée) :
 *   L'ancien code faisait `o === n || n.endsWith(o) || o.endsWith(n)`.
 *   Résultat : tout numéro SE TERMINANT par les chiffres du owner
 *   (ex: 9237693978044) — ou tout suffixe court (…978044) — devenait
 *   owner : élévation de privilèges. Ici la comparaison se fait
 *   UNIQUEMENT sur les chiffres, à égalité stricte, après strip de
 *   tout ce qui n'est pas un chiffre («+», espaces, suffixe
 *   d'appareil «:xx», «@domaine»…).
 *
 * AUCUN SECRET EN DUR : OWNER_NUMBER / SUDO_NUMBER sont lus dans .env
 * via config.js. Les listes mutables vivent dans state.settings et
 * sont persistées dans data/state.json.
 *
 * state vit dans handler.js : injection par bind() au démarrage
 * (évite le require circulaire).
 */

const config = require('../config');

/* ── Injection de l'état (appelée une fois par handler.js) ─────── */
let _state = null;
let _save = () => {};

function bind(state, save) {
  _state = state;
  _save = typeof save === 'function' ? save : () => {};
}

/* ── Normalisation stricte → chiffres seuls ──────────────────────
   Gère les JID bruts : retire le suffixe d'appareil « :12 », puis le
   domaine « @s.whatsapp.net » / « @lid », puis tout ce qui n'est pas
   un chiffre («+», espaces…). */
function normalize(raw) {
  let s = String(raw || '');
  if (s.startsWith('@')) s = s.slice(1);   // mention WhatsApp : @2376…
  s = s.replace(/:\d+@/, '@');             // suffixe d'appareil :12@ → @
  s = s.replace(/@.*$/, '');               // domaine @s.whatsapp.net / @lid
  return s.replace(/\D/g, '');
}

/* ── OWNER — comparaison EXACTE contre OWNER_NUMBER (.env) ─────── */
function isOwner(raw) {
  const d = normalize(raw);
  return !!d && config.ownerNumber.includes(d);
}

/* ── SUDO — env SUDO_NUMBER + state.settings.sudo, exact ───────── */
function sudoList() {
  const fromEnv = String(process.env.SUDO_NUMBER || '')
    .split(/[,\s]+/)
    .map(normalize)
    .filter(Boolean);
  const fromState = Array.isArray(_state?.settings?.sudo)
    ? _state.settings.sudo.map(normalize).filter(Boolean)
    : [];
  return [...new Set([...fromEnv, ...fromState])];
}

function isSudo(raw) {
  const d = normalize(raw);
  return !!d && sudoList().includes(d);
}

/* ── ACCEPTED — { n: '2376…', until: null | timestamp } ────────── */
function acceptedArray() {
  if (!_state) return [];
  if (!_state.settings) _state.settings = {};
  if (!Array.isArray(_state.settings.accepted)) _state.settings.accepted = [];
  return _state.settings.accepted;
}

/** Acceptation avec expiration optionnelle (ttlMs = null → permanent). */
function accept(raw, ttlMs = null) {
  const d = normalize(raw);
  if (d.length < 8) return { ok: false, raison: 'NUMERO TROP COURT' };
  if (isOwner(d)) return { ok: false, deja: true, raison: 'DEJA OWNER' };
  const list = acceptedArray();
  const until = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null;
  const hit = list.find((e) => e && e.n === d);
  if (hit) hit.until = until;          // ré-acceptation = mise à jour
  else list.push({ n: d, until });
  _save(true);                          // persistance immédiate
  return { ok: true, n: d, until };
}

/** Révocation. */
function unaccept(raw) {
  const d = normalize(raw);
  const list = acceptedArray();
  const next = list.filter((e) => !e || e.n !== d);
  const removed = next.length !== list.length;
  if (removed) {
    _state.settings.accepted = next;
    _save(true);
  }
  return { ok: removed, n: d };
}

/** L'utilisateur est-il accepté ? (l'expiration purge l'entrée) */
function isAccepted(raw) {
  const d = normalize(raw);
  if (!d) return false;
  const list = acceptedArray();
  const hit = list.find((e) => e && e.n === d);
  if (!hit) return false;
  if (hit.until && hit.until <= Date.now()) {
    _state.settings.accepted = list.filter((e) => e !== hit);
    _save(true);
    return false;
  }
  return true;
}

/** Liste propre : purge des expirés puis rendu [{ n, until }]. */
function listAccepted() {
  const list = acceptedArray();
  const now = Date.now();
  const vivants = list.filter((e) => e && (!e.until || e.until > now));
  if (vivants.length !== list.length) {
    _state.settings.accepted = vivants;
    _save(true);
  }
  return vivants.map((e) => ({ n: e.n, until: e.until || null }));
}

/* ── GATE : l'utilisateur a-t-il le droit d'exécuter une commande ? */
function canRun(raw) {
  return isOwner(raw) || isSudo(raw) || isAccepted(raw);
}

/* ── Anti-spam du gate : 1 avertissement / 60 s / expéditeur ───── */
const _refus = new Map();
const REFUS_COOLDOWN_MS = 60 * 1000;
const REFUS_MAP_MAX = 500;

function shouldNotifyGate(raw) {
  const d = normalize(raw) || String(raw || '?');
  const now = Date.now();
  const last = _refus.get(d) || 0;
  if (now - last < REFUS_COOLDOWN_MS) return false;
  if (_refus.size > REFUS_MAP_MAX) _refus.clear(); // garde-fou mémoire
  _refus.set(d, now);
  return true;
}

module.exports = {
  bind,
  normalize,
  isOwner,
  isSudo,
  sudoList,
  accept,
  unaccept,
  isAccepted,
  listAccepted,
  canRun,
  shouldNotifyGate,
};
