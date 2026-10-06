'use strict';
const config = require('./config');
const ui = require('./ui');
const { send } = require('../../lib/wa-send');
/* Journal SQLite local (data/bot.db) — option « base locale ».
   Le module est importé en lazy dans record() : guard reste utilisable
   sans node:sqlite, et une panne de base n'interrompt JAMAIS une
   protection. */
const localDb = require('../../lib/db');

/** Envoie un rapport au propriétaire (silencieux si GUARD_LOG est désactivé). */
async function notifyOwner(sock, lines) {
  if (!config.log || !config.owners.length) return false;
  try {
    await send(sock, `${config.owners[0]}@s.whatsapp.net`, { text: ui.frame('JOURNAL GUARD', lines) });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Journalise une sanction/protéction dans la base locale (`.journal`).
 * @param {string} type   protect | antifake | link | …
 * @param {string} chat   JID du groupe
 * @param {string} actor  numéro de l'auteur de l'infraction
 * @param {string} detail libellé de la protection + sanction
 */
function record(type, chat, actor, detail) {
  try {
    localDb.logEvent({ type, chat, actor, detail });
  } catch { /* base indisponible : la protection passe avant */ }
}

module.exports = { notifyOwner, record };
