'use strict';
/**
 * Mode nuit : ferme le groupe aux non-admins entre nightStart et nightEnd,
 * le rouvre ensuite. Nécessite que le bot soit admin (sinon nouvel essai à la minute suivante).
 */
const config = require('./config');
const { db } = require('./db');
const perms = require('./utils/perms');
const { send } = require('../../lib/wa-send');
const ui = require('./ui');

const toMin = (hm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || ''));
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
};

/** Minutes écoulées depuis minuit dans le fuseau configuré. */
function minutesNow(now = new Date(), tz = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = +parts.find((p) => p.type === 'hour').value;
  const m = +parts.find((p) => p.type === 'minute').value;
  return h * 60 + m;
}

/** true si `n` est dans [start, end[ (fenêtre pouvant enjamber minuit) */
function inWindow(n, start, end) {
  if (start === null || end === null || start === end) return false;
  return start < end ? n >= start && n < end : n >= start || n < end;
}

async function tick(sock, now = new Date()) {
  const n = minutesNow(now);
  const changed = [];
  for (const [gid, g] of Object.entries(db().data.groups)) {
    if (!g.nightMode) continue;
    const shouldClose = inWindow(n, toMin(g.nightStart), toMin(g.nightEnd));
    if (shouldClose === !!g.nightClosed) continue;
    const meta = await perms.groupMeta(sock, gid, true);
    if (!meta || !perms.botIsAdmin(sock, meta)) continue; // réessai à la prochaine minute
    try {
      await sock.groupSettingUpdate(gid, shouldClose ? 'announcement' : 'not_announcement');
      g.nightClosed = shouldClose;
      db().saveGroup(gid, g);
      changed.push(gid);
      await send(sock, gid, {
        text: shouldClose
          ? ui.frame('MODE NUIT', ['🌙 ' + ui.kv('GROUPE', 'FERMÉ (ADMINS SEULEMENT)'), ui.kv('RÉOUVERTURE', g.nightEnd)])
          : ui.frame('MODE NUIT', ['☀️ ' + ui.kv('GROUPE', 'RÉOUVERT À TOUS'), ui.kv('BONJOUR', 'BONNE JOURNÉE !')]),
      }).catch(() => {});
    } catch (e) {
      console.error('[NIGHT]', gid, e.message);
    }
  }
  return changed;
}

let timer = null;
function stop() { if (timer) { clearInterval(timer); timer = null; } }
function start(sock) {
  stop();
  timer = setInterval(() => tick(sock).catch(() => {}), 60 * 1000);
  if (timer.unref) timer.unref();
  setTimeout(() => tick(sock).catch(() => {}), 5000).unref?.();
}

module.exports = { tick, start, stop, inWindow, toMin, minutesNow };
