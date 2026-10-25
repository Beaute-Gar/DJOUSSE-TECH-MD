'use strict';
const { cmd } = require('./registry');
const { db } = require('../db');
const { PROTECTIONS } = require('../engine');
const ui = require('../ui');
const { kv } = ui;

cmd({
  name: 'groupstats', aliases: ['gstats'], admin: true, desc: 'Statistiques de protection',
  async run(c) {
    const g = db().getGroup(c.from);
    const s = g.stats;
    const actives = PROTECTIONS.filter((p) => g[p.key]).length;
    return c.reply(ui.frame('GROUP STATS', [
      `👥 ${kv('MEMBRES', c.meta.participants.length)}`,
      `👑 ${kv('ADMINS', c.meta.participants.filter((p) => p.admin).length)}`,
      `🔗 ${kv('LIENS SUPPRIMÉS', s.antilink)}`,
      `🧨 ${kv('SPAM / FLOOD', `${s.antispam} / ${s.antiflood}`)}`,
      `🤬 ${kv('MOTS BANNIS', s.antibad)}`,
      `📵 ${kv('MENTIONS STATUT', s.antistatus)}`,
      `💣 ${kv('VIRTEX', s.antivirtex)}`,
      `🧬 ${kv('FAUX NUMÉROS', s.antifake)}`,
      `🗑️ ${kv('MESSAGES SUPPRIMÉS', s.deleted)}`,
      `⚠️ ${kv('AVERTISSEMENTS', s.warned)}`,
      `🔇 ${kv('MUTES', s.muted)}`,
      `🚫 ${kv('EXPULSIONS', s.kicked)}`,
      `💬 ${kv('MESSAGES TRAITÉS', s.messages)}`,
      `🛡️ ${kv('PROTECTIONS ACTIVES', actives)}`,
    ]));
  },
});
