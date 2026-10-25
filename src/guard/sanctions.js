'use strict';
const { db } = require('./db');
const { jidNum } = require('./utils/perms');

const keyOf = (jid) => jidNum(jid);

function isMuted(gid, jid) {
  const until = db().getMuteUntil(gid, keyOf(jid));
  if (!until) return false;
  if (Date.now() >= until) { db().setMute(gid, keyOf(jid), 0); return false; }
  return true;
}

function mute(gid, jid, ms) {
  db().setMute(gid, keyOf(jid), Date.now() + ms);
}
const unmute = (gid, jid) => db().setMute(gid, keyOf(jid), 0);

/**
 * Ajoute un avertissement. Au seuil : kick ou mute selon la config du groupe.
 * Retourne { count, limit, escalated: null|'kick'|'mute' }
 */
async function warn(sock, gid, jid, g, botAdmin) {
  const k = keyOf(jid);
  const count = db().getWarns(gid, k) + 1;
  g.stats.warned++;
  let escalated = null;
  if (count >= g.warnLimit) {
    db().setWarns(gid, k, 0);
    if (g.onWarnLimit === 'mute') {
      mute(gid, jid, g.muteMinutes * 60000);
      g.stats.muted++;
      escalated = 'mute';
    } else if (botAdmin) {
      await sock.groupParticipantsUpdate(gid, [jid], 'remove').catch(() => {});
      g.stats.kicked++;
      escalated = 'kick';
    }
  } else {
    db().setWarns(gid, k, count);
  }
  db().saveGroup(gid, g);
  return { count, limit: g.warnLimit, escalated };
}

module.exports = { isMuted, mute, unmute, warn };
