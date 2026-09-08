'use strict';

/* Timeout + exécution sûre pour les appels externes (API, téléchargements).
   Aucune commande ne doit faire planter le process ni exposer une stack trace. */

function withTimeout(promise, ms = 15000, label = 'cmd') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT_' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* Retourne { ok, value | error } — error est un message utilisateur propre. */
async function safeExec(fn, ms = 12000, label = 'api') {
  try {
    const value = await withTimeout(fn(), ms, label);
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      error: e && e.message === 'TIMEOUT_' + label
        ? '⏳ ' + label + ' trop lent, réessaie plus tard.'
        : '❌ ' + label + ' indisponible, réessaie plus tard.',
    };
  }
}

module.exports = { withTimeout, safeExec };