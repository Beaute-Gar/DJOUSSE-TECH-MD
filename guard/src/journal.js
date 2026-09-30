'use strict';
const config = require('./config');
const ui = require('./ui');
const { send } = require('../../lib/wa-send');

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
module.exports = { notifyOwner };
