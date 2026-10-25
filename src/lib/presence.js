'use strict';
/**
 * Présence en direct (Baileys presence.subscribe → presence.update).
 * Un SEUL listener ev.on('presence.update') est installé par index.js :
 * il délègue ici ; les demandes arrivent par track() (commande .seen).
 * La clé est normalisée (sans @server ni suffixe appareil) pour que
 * '2376…@s.whatsapp.net' matche '2376…:12@s.whatsapp.net' ou '…@lid'.
 */
const pending = new Map(); // clé normalisée → { resolve, timer }

function norm(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

/** Inscrit une demande et attend l'état (null si timeout). */
function track(jid, timeoutMs = 8000) {
  const key = norm(jid);
  if (!key) return Promise.resolve(null);
  drop(key);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      resolve(null);
    }, timeoutMs);
    pending.set(key, { resolve, timer });
  });
}

/** Alimenté par le listener index.js : resout les demandes en attente. */
function handle(update) {
  try {
    const presences = update?.presences || {};
    let matched = false;
    for (const raw of Object.keys(presences)) {
      const entry = pending.get(norm(raw));
      if (!entry) continue;
      clearTimeout(entry.timer);
      pending.delete(norm(raw));
      entry.resolve(presences[raw] || null);
      matched = true;
    }
    return matched;
  } catch (_) {
    return false;
  }
}

/** Retire une demande en attente (remplacement / annulation → null). */
function drop(jid) {
  const key = norm(jid);
  const entry = pending.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(key);
    entry.resolve(null);
  }
}

/** État lisible à partir de PresenceData (ou d'une chaîne brute). */
function label(p) {
  const raw = typeof p === 'string' ? p : String((p && p.lastKnownPresence) || '');
  const map = {
    available: 'EN LIGNE',
    unavailable: 'HORS LIGNE',
    composing: 'ÉCRIT…',
    recording: 'ENREGISTRE…',
    paused: 'EN PAUSE',
    play: 'VOIX…',
  };
  return map[raw] || (raw ? raw.toUpperCase() : 'INCONNU');
}

module.exports = { track, handle, drop, label, norm, _pending: pending };
