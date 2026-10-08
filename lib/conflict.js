'use strict';
/**
 * lib/conflict.js — MODULE 2 : DÉTECTION DE CONFLITS (« autre bot » sur le chat)
 * ───────────────────────────────────────────────────────────────────────────────
 * Objectif : éviter les boucles de réponses entre deux bots (deux instances
 * de DJOUSE, ou un autre bot qui répond au nôtre). Dès qu'un chat paraît
 * « géré par un autre bot », le chat passe EN PAUSE : plus aucune réponse
 * automatique du bot sur ce chat — les protections de groupe (guard/)
 * continuent de s'appliquer, et le OWNER reste exempt (il peut diagnostiquer
 * et lancer .unpause).
 *
 * Baileys n'expose AUCUN indicateur `isBot` sur les participants (vérifié :
 * aucun champ dans lib/Types) → la détection est COMPORTEMENTALE, 3 déclencheurs :
 *
 *  1. SIGNATURE DE CADRE — un message entrant contenant nos propres
 *     rendus (marques ╭ / ╰) est la sortie d'un AUTRE DJOUSE : boucle
 *     garantie. Les marques sont DÉRIVÉES de style.js (jamais écrites en
 *     dur ici — contrôle G4 de scripts/audit.js).
 *  2. PING-PONG RAPIDE — ≥6 messages texte en ≤10 s alternant « nous /
 *     lui » (≥4 changements de camp) dont ≥2 messages d'un NON-owner :
 *     conversation automatique, pas humaine. Les échanges owner ↔ bot
 *     (tests rapides de commandes) sont exemptés car chaque entrée owner
 *     ne compte pas comme « non-owner ».
 *  3. PARTICIPANT isBOT — si le serveur WhatsApp marque un participant
 *     `isBot` (champ hors types Baileys, parfois présent dans le métadonnées
 *     de groupe), et que ce n'est pas nous.
 *
 * La pause est en MÉMOIRE (un redémarrage repart à zéro et re-détecte
 * rapidement si le conflit persiste) et ne se lève que par `.unpause`
 * (owner) — `.conflicts` liste l'état.
 *
 * Aucun secret, aucun envoi ici : le module est PUR (testable sans socket).
 * L'avertissement est envoyé par handler.js qui possède le style + le send.
 */

const auth = require('./auth');
const style = require('../style');

/* ── Marques de cadre DÉRIVÉES de style.js ────────────────────────
   style.js est le SEUL propriétaire des glyphes (audit G4) : on en
   extrait les marques d'ouverture/fermeture au lieu de les dupliquer.
   frameHeader('') → « ╭┄┄『 』┄❍ » · frameFooter() → « ╰┄┄… » */
const FRAME_OPEN = style.frameHeader('')[0];
const FRAME_CLOSE = style.frameFooter()[0];
const looksLikeFrame = (text) =>
  typeof text === 'string' && text.includes(FRAME_OPEN) && text.includes(FRAME_CLOSE);

/* ── Seuils du ping-pong (fenêtre glissante) ────────────────────── */
const WINDOW_MS = 10 * 1000;  // 10 s
const MIN_EVENTS = 6;         // messages texte minimum dans la fenêtre
const MIN_TRANSITIONS = 4;    // changements nous/lui minimum
const MIN_NON_OWNER = 2;      // messages de non-owner minimum

/* chat → { paused, reason, at, events } */
const chats = new Map();

function stateOf(chat) {
  let s = chats.get(chat);
  if (!s) {
    s = { paused: false, reason: null, at: 0, events: [] };
    chats.set(chat, s);
  }
  return s;
}

/** Met le chat en pause (idempotent). { first: true } = 1ʳᵉ détection. */
function markPaused(chat, reason) {
  const s = stateOf(chat);
  if (s.paused) return { conflict: true, first: false, reason: s.reason };
  s.paused = true;
  s.reason = reason;
  s.at = Date.now();
  s.events = [];
  return { conflict: true, first: true, reason };
}

/**
 * Observation de CHAQUE message — appelée par handler.js AVANT le filtre
 * d'échos fromMe : elle doit voir aussi nos propres réponses pour compter
 * les allers-retours.
 * @returns {{conflict: boolean, first: boolean, reason?: string}}
 */
function observe({ chat, text, fromMe, owner }) {
  if (!chat) return { conflict: false, first: false };
  const s = stateOf(chat);
  if (s.paused) return { conflict: true, first: false, reason: s.reason };

  /* 1 — signature de cadre (sortie d'un autre DJOUSE) */
  if (!fromMe && looksLikeFrame(text)) {
    return markPaused(chat, 'signature-cadre');
  }

  /* 2 — ping-pong rapide hors owner */
  if (text) {
    const now = Date.now();
    s.events.push({ ts: now, fromMe: !!fromMe, owner: !!owner });
    while (s.events.length && now - s.events[0].ts > WINDOW_MS) s.events.shift();
    if (s.events.length >= MIN_EVENTS) {
      let transitions = 0;
      let nonOwner = 0;
      for (let i = 1; i < s.events.length; i += 1) {
        const a = s.events[i - 1];
        const b = s.events[i];
        if (a.fromMe !== b.fromMe) transitions += 1;
        if (!b.fromMe && !b.owner) nonOwner += 1;
      }
      if (transitions >= MIN_TRANSITIONS && nonOwner >= MIN_NON_OWNER) {
        return markPaused(chat, 'ping-pong');
      }
    }
  }
  return { conflict: false, first: false };
}

/** Participant marqué `isBot` par le serveur (hors notre propre numéro) ? */
function hasBotParticipant(meta, selfNum) {
  if (!meta?.participants?.length) return false;
  return meta.participants.some((p) => {
    if (!p || p.isBot !== true) return false;
    if (!selfNum) return true;
    return auth.normalize(p.id) !== auth.normalize(selfNum);
  });
}

function isPaused(chat) {
  return !!chats.get(chat)?.paused;
}

function reasonOf(chat) {
  return chats.get(chat)?.reason || null;
}

/** Levée de pause — true si le chat était bien en pause. */
function resume(chat) {
  const s = chats.get(chat);
  if (!s || !s.paused) return false;
  s.paused = false;
  s.reason = null;
  s.at = 0;
  s.events = [];
  return true;
}

function status() {
  return [...chats.entries()]
    .filter(([, s]) => s.paused)
    .map(([chat, s]) => ({ chat, reason: s.reason, at: s.at }));
}

/** Réinitialisation complète (tests uniquement). */
function reset() {
  chats.clear();
}

module.exports = {
  observe,
  markPaused,
  hasBotParticipant,
  isPaused,
  reasonOf,
  resume,
  status,
  reset,
};
