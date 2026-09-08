'use strict';

/* lib/confirm.cjs — Confirmation des commandes destructrices.
   PRINCIPE : une commande lourde (.delall, .broadcast...) demande d'abord
   confirmation via .confirm dans un délai de 30 s. Sans confirmation, aucune
   action n'est exécutée. La confirmation est scopée par (émetteur|cible). */

const pending = new Map(); // clé `${sender}|${chat}` → { desc, fn, expiresAt }
const DEFAULT_TTL_MS = 30000;

function keyFor(m) {
  return `${m.sender || '?'}|${m.chat || '?'}`;
}

/* Demande la confirmation. Retourne toujours false pour que la commande
   appelante retourne immédiatement après avoir affiché le prompt. */
function prompt(conn, m, desc, fn, ttlMs = DEFAULT_TTL_MS) {
  const key = keyFor(m);
  cleanupNow();
  pending.set(key, { desc, fn, expiresAt: Date.now() + ttlMs });
  m.reply(`⚡ *CONFIRMATION REQUISE*\n\n${desc}\n\nRéponds \`.confirm\` dans les ${Math.round(ttlMs / 1000)} s pour exécuter.`);
  return false;
}

async function run(conn, m) {
  const key = keyFor(m);
  cleanupNow();
  const entry = pending.get(key);
  if (!entry) return m.reply('❌ Aucune action en attente de confirmation.');
  if (entry.expiresAt < Date.now()) {
    pending.delete(key);
    return m.reply('❌ Confirmation expirée. Relance la commande.');
  }
  pending.delete(key);
  try {
    await entry.fn(conn, m);
  } catch (e) {
    m.reply('❌ ' + (e.message || String(e)));
  }
}

function cleanupNow() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
}

setInterval(cleanupNow, 10000).unref();

module.exports = { prompt, run, DEFAULT_TTL_MS, _pending: pending };