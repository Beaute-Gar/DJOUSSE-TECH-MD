'use strict';
/**
 * wa-delay.js — délais humains partagés + normalisation des JID
 * ─────────────────────────────────────────────────────────────────
 * Source UNIQUE des calculs de rythme utilisés par :
 *   - src/lib/wa-secure.js   (réponses, médias, bursts, broadcast)
 *   - src/lib/wa-presence.js (délai avant « vu »)
 *
 * Aucune dépendance Baileys ici : uniquement des maths et des chaînes,
 * pour rester testable sans socket.
 *
 * Le délai se compose d'un temps de « réflexion » + temps de lecture du
 * message reçu + temps de frappe de la réponse, le tout jitteré puis
 * borné. Un groupe répond plus vite qu'un DM (facteur 0,6) et un statut
 * est presque instantané.
 */

const DEFAULTS = {
  BASE_THINK_MS: 1200,
  READ_CPS: 25,
  TYPE_CPS: 18,
  JITTER: 0.25,
  MIN_DELAY_MS: 800,
  MAX_DELAY_MS: 25000,
  GROUP_DELAY_FACTOR: 0.6,
  DM_DELAY_FACTOR: 1.0,
  STATUS_DELAY_MS: 300,
};

/** Attente simple (0 → promesse déjà résolue). */
function sleep(ms) {
  const delay = Number(ms);
  if (!Number.isFinite(delay) || delay <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Applique un jitter symétrique (± ratio) à une durée en ms. */
function applyJitter(ms, ratio = DEFAULTS.JITTER) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const r = Math.abs(Number(ratio) || 0);
  if (!r) return Math.round(value);
  const factor = 1 - r + Math.random() * (r * 2);
  return Math.max(0, Math.round(value * factor));
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function isStatusJid(jid) {
  return jid === 'status@broadcast';
}

function isNewsletterJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@newsletter');
}

function isLidJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@lid');
}

/**
 * Normalise un JID :
 *   '33612345678'            → '33612345678@s.whatsapp.net'
 *   '33612345678:12@...'     → '33612345678@s.whatsapp.net'
 *   groupe / statut / newsletter / lid → inchangé
 */
function normalizeJid(jid) {
  if (!jid || typeof jid !== 'string') return jid;
  if (isStatusJid(jid) || isGroupJid(jid) || isNewsletterJid(jid) || isLidJid(jid)) return jid;
  let value = jid.split(':')[0];
  if (!value.includes('@')) value = `${value.replace(/\D/g, '')}@s.whatsapp.net`;
  return value;
}

/**
 * Calcule un délai humain avant d'envoyer un message.
 *
 * @param {object} p
 * @param {string} [p.incoming] texte reçu (temps de lecture)
 * @param {string} [p.outgoing] texte à envoyer (temps de frappe)
 * @param {string} [p.jid]      destinataire (groupe / statut / DM)
 * @param {object} [p.cfg]      surcharge des constantes DEFAULTS
 * @param {number} [p.bias]     multiplicateur de persona (identité)
 * @returns {number} durée en millisecondes
 */
function computeDelay({ incoming = '', outgoing = '', jid, cfg, bias } = {}) {
  const c = { ...DEFAULTS, ...(cfg || {}) };
  const readCps = Number(c.READ_CPS) > 0 ? Number(c.READ_CPS) : DEFAULTS.READ_CPS;
  const typeCps = Number(c.TYPE_CPS) > 0 ? Number(c.TYPE_CPS) : DEFAULTS.TYPE_CPS;

  const readMs = String(incoming || '').length / readCps * 1000;
  const typeMs = String(outgoing || '').length / typeCps * 1000;

  let base = Number(c.BASE_THINK_MS) + readMs + typeMs;

  if (isStatusJid(jid)) {
    base = Number(c.STATUS_DELAY_MS);
  } else if (isGroupJid(jid)) {
    base *= Number(c.GROUP_DELAY_FACTOR);
  } else {
    base *= Number(c.DM_DELAY_FACTOR);
  }

  const personaBias = Number(bias);
  if (Number.isFinite(personaBias) && personaBias > 0) base *= personaBias;

  const min = Math.max(0, Number(c.MIN_DELAY_MS) || 0);
  const max = Math.max(min, Number(c.MAX_DELAY_MS) || min);
  return clamp(applyJitter(base, c.JITTER), min, max);
}

module.exports = {
  DEFAULTS,
  sleep,
  applyJitter,
  computeDelay,
  isGroupJid,
  isStatusJid,
  isNewsletterJid,
  isLidJid,
  normalizeJid,
};
