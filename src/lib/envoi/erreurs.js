'use strict';
/**
 * lib/envoi/erreurs.js — classification des erreurs Baileys/WhatsApp
 * ────────────────────────────────────────────────────────────────────
 * Une erreur non classée est une erreur qu'on rejoue « au cas où » — et
 * c'est exactement comme ça qu'un numéro se fait restreindre. Chaque code
 * renvoie une ACTION, pas seulement un message :
 *
 *   pauseMs : suspendre TOUS les envois pendant N ms
 *   retenter : oui / non (un retry agressif est un anti-pattern)
 *   alerte   : remonter à l'opérateur
 *
 * Baileys renvoie le plus souvent un Boom (`err.output.statusCode`) dont
 * `err.data` porte le code de stanza WhatsApp (ex. 463, 131026).
 */

const ACTIONS = {
  RATE_OVERLIMIT: { pauseMs: 15 * 60000, retenter: false, alerte: true },
  REACHOUT_RESTRICTED: { pauseMs: 24 * 3600000, retenter: false, alerte: true },
  INVALID_RECIPIENT: { pauseMs: 0, retenter: false, alerte: false },
  SESSION_INVALID: { pauseMs: 0, retenter: false, alerte: true },
  SERVER_ERROR: { pauseMs: 60000, retenter: true, alerte: true },
  NETWORK: { pauseMs: 30000, retenter: true, alerte: false },
  UNKNOWN: { pauseMs: 30000, retenter: false, alerte: true },
};

/** Codes numériques WhatsApp connus. */
const CODES = {
  401: 'SESSION_INVALID',
  403: 'REACHOUT_RESTRICTED',
  404: 'INVALID_RECIPIENT',
  408: 'NETWORK',
  429: 'RATE_OVERLIMIT',
  463: 'REACHOUT_RESTRICTED',
  500: 'SERVER_ERROR',
  502: 'SERVER_ERROR',
  503: 'SERVER_ERROR',
  504: 'SERVER_ERROR',
  131026: 'INVALID_RECIPIENT',
  131047: 'REACHOUT_RESTRICTED',
  131056: 'RATE_OVERLIMIT',
};

const MOTIFS = [
  [/reachout.?restricted|not.?authorized|forbidden/i, 'REACHOUT_RESTRICTED'],
  [/rate.?overlimit|too many requests|quota|flood/i, 'RATE_OVERLIMIT'],
  [/invalid recipient|not a whatsapp user|item-not-found|jid.*invalid/i, 'INVALID_RECIPIENT'],
  [/logged out|session.*(invalid|closed)|connection (closed|failure)|unauthorized/i, 'SESSION_INVALID'],
  [/timed? ?out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i, 'NETWORK'],
  [/internal server|service unavailable|bad gateway/i, 'SERVER_ERROR'],
];

function codeDe(err) {
  const candidats = [
    err?.data?.code,
    err?.data?.statusCode,
    err?.output?.statusCode,
    err?.statusCode,
    err?.status,
  ];
  for (const c of candidats) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * @param {any} err
 * @returns {{code:string, action:string, pauseMs:number, retenter:boolean, alerte:boolean, message:string, statut:number|null}}
 */
function classer(err) {
  const statut = codeDe(err);
  const texte = [err?.message, err?.data?.message, err?.output?.payload?.message]
    .filter(Boolean).join(' | ');

  let code = statut ? CODES[statut] : null;
  if (!code) {
    for (const [re, c] of MOTIFS) if (re.test(texte)) { code = c; break; }
  }
  if (!code) code = statut && statut >= 500 ? 'SERVER_ERROR' : 'UNKNOWN';

  const action = ACTIONS[code] || ACTIONS.UNKNOWN;
  return {
    code,
    action: action.pauseMs ? `pause ${Math.round(action.pauseMs / 1000)}s` : 'aucune pause globale',
    pauseMs: action.pauseMs,
    retenter: action.retenter,
    alerte: action.alerte,
    message: texte.slice(0, 300) || code,
    statut,
  };
}

module.exports = { classer, ACTIONS, CODES };
