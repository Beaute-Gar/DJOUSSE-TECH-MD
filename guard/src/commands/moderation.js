'use strict';
const { cmd } = require('./registry');
const { db } = require('../db');
const sanctions = require('../sanctions');
const { jidNum } = require('../utils/perms');
const { parseDuration, formatDuration } = require('../utils/time');
const ui = require('../ui');
const { kv } = ui;

/** Cible = 1re mention > message cité > numéro tapé */
function target(c) {
  if (c.mentions[0]) return c.mentions[0];
  if (c.quotedParticipant) return c.quotedParticipant;
  const n = (c.args.find((a) => /^\+?\d{6,15}$/.test(a)) || '').replace('+', '');
  return n ? n + '@s.whatsapp.net' : null;
}
const need = (c) => c.reply(ui.error(['MENTIONNEZ UN MEMBRE, RÉPONDEZ À SON MESSAGE', 'OU DONNEZ SON NUMÉRO']));
const adminGuard = (c, t) => (c.isTargetAdmin(t) ? c.reply(ui.error(['IMPOSSIBLE SUR UN ADMINISTRATEUR'])) : null);

cmd({
  name: 'mute', admin: true, botAdmin: true, desc: 'Rendre muet : mute @user 30m',
  async run(c) {
    const t = target(c); if (!t) return need(c);
    if (c.isTargetAdmin(t)) return adminGuard(c, t);
    const durArg = c.args.find((a) => /^\d+\s*[smhd]?$/i.test(a) && !/^\d{6,}$/.test(a));
    const ms = durArg ? parseDuration(durArg) : db().getGroup(c.from).muteMinutes * 60000;
    sanctions.mute(c.from, t, ms);
    return c.reply(ui.frame('MUTE', [`🔇 @${jidNum(t)}`, kv('DURÉE', formatDuration(ms).toUpperCase()), 'SES MESSAGES SERONT SUPPRIMÉS']), [t]);
  },
});

cmd({
  name: 'unmute', admin: true, desc: 'Rétablir un membre',
  async run(c) {
    const t = target(c); if (!t) return need(c);
    sanctions.unmute(c.from, t);
    return c.reply(ui.frame('UNMUTE', [`🔊 @${jidNum(t)}`, 'PEUT DE NOUVEAU ÉCRIRE']), [t]);
  },
});
