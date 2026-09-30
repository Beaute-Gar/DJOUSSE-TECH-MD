'use strict';
const { cmd } = require('./registry');
const { db } = require('../db');
const { PROTECTIONS } = require('../engine');
const nightmode = require('../nightmode');
const ui = require('../ui');

const { kv, onoff, parseSwitch, ICONS } = ui;
const usage = (c, s) => c.reply(ui.error([`UTILISATION : ${c.prefix}${s}`]));

// .antilink | .antibad | … : on / off / sans argument = bascule (par groupe)
for (const p of PROTECTIONS) {
  cmd({
    name: p.key,
    admin: true,
    desc: `${p.label} on/off (par groupe)`,
    async run(c) {
      const g = db().getGroup(c.from);
      const arg = c.args[0];
      let val = parseSwitch(arg);
      if (arg && val === null) return usage(c, `${p.key} on|off`);
      if (val === null) val = !g[p.key];
      g[p.key] = val;
      db().saveGroup(c.from, g);
      const lines = [`${ICONS[p.key] || '🛡️'} ${kv('ÉTAT', val ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌')}`, kv('PORTÉE', 'CE GROUPE UNIQUEMENT')];
      if (val) lines.push(kv('ADMINS', 'EXEMPTÉS'));
      if (val && !c.botAdmin) lines.push("⚠️ BOT NON ADMIN : PROMOUVEZ-LE (REPRISE AUTO)");
      if (val && p.key === 'antibad' && !g.badWords.length) lines.push(`ℹ️ LISTE VIDE : ${c.prefix}addbad <mot>`);
      if (val && p.defaultSanction) lines.push(kv('SANCTION PAR DÉFAUT', p.defaultSanction.toUpperCase()));
      return c.reply(ui.frame(p.label.toUpperCase(), lines));
    },
  });
}

cmd({
  name: 'security', admin: true, desc: 'Pack sécurité on/off',
  async run(c) {
    const val = parseSwitch(c.args[0]);
    if (val === null) return usage(c, 'security on|off');
    const pack = ['antilink', 'antispam', 'antiflood', 'antibad', 'antitag', 'antistatus', 'antivirtex'];
    const g = db().getGroup(c.from);
    pack.forEach((k) => (g[k] = val));
    db().saveGroup(c.from, g);
    return c.reply(ui.frame('DJOUSSE SECURITY', [kv('PACK', val ? 'ACTIVÉ' : 'DÉSACTIVÉ'), ...pack.map((k) => `${val ? '✅' : '❌'} ${k.toUpperCase()}`)]));
  },
});

cmd({
  name: 'settings', aliases: ['config'], admin: true, desc: 'Configuration du groupe',
  async run(c) {
    const g = db().getGroup(c.from);
    const rows = PROTECTIONS.map((p) => `${ICONS[p.key] || '🛡️'} ${p.label.toUpperCase()}: ${onoff(g[p.key])}`);
    const over = Object.entries(g.sanctions).map(([k, v]) => `${k}=${v}`).join(', ');
    return c.reply(ui.frame('GROUP SETTINGS', [
      ...rows,
      `🧬 ANTI-FAKE: ${onoff(g.antifake)} (${g.allowedCodes.join(',') || '—'})`,
      `🌙 ${kv('MODE NUIT', g.nightMode ? `${g.nightStart} → ${g.nightEnd} ✅` : 'OFF ❌')}`,
      kv('SANCTION', g.sanction + (over ? ` | ${over}` : '')),
      kv('WARN LIMIT', `${g.warnLimit} → ${g.onWarnLimit}`),
      kv('MUTE', `${g.muteMinutes} MIN`),
      kv('FLOOD', `${g.floodMax} MSG / ${g.floodWindowSec}S`),
      kv('TAG MAX', g.tagMax),
      kv('TAILLE MAX', g.maxText),
      kv('MOTS BANNIS', g.badWords.length),
      kv('DOMAINES OK', g.linkWhitelist.join(', ') || '—'),
    ]));
  },
});

const setNum = (name, field, min, max, label) =>
  cmd({
    name, admin: true, desc: label,
    async run(c) {
      const n = parseInt(c.args[0], 10);
      if (!Number.isInteger(n) || n < min || n > max) return usage(c, `${name} <${min}-${max}>`);
      const g = db().getGroup(c.from); g[field] = n; db().saveGroup(c.from, g);
      return c.reply(ui.frame(label.toUpperCase(), [kv('VALEUR', n)]));
    },
  });
setNum('warnlimit', 'warnLimit', 1, 20, "Limite d'avertissements");
setNum('muteminutes', 'muteMinutes', 1, 10080, 'Durée de mute (min)');
setNum('tagmax', 'tagMax', 1, 100, 'Mentions max par message');
setNum('maxtext', 'maxText', 500, 20000, 'Taille max des messages');

cmd({
  name: 'floodset', admin: true, desc: 'Réglage anti-flood : floodset <msgs> <sec>',
  async run(c) {
    const m = parseInt(c.args[0], 10), s = parseInt(c.args[1], 10);
    if (!(m >= 2 && m <= 50 && s >= 2 && s <= 120)) return usage(c, 'floodset <2-50> <2-120>');
    const g = db().getGroup(c.from); g.floodMax = m; g.floodWindowSec = s; db().saveGroup(c.from, g);
    return c.reply(ui.frame('ANTI-FLOOD', [kv('LIMITE', `${m} MSG / ${s}S`)]));
  },
});

cmd({
  name: 'sanction', admin: true, desc: 'Sanction : sanction [protection] delete|warn|kick',
  async run(c) {
    const keys = PROTECTIONS.map((p) => p.key);
    const modes = ['delete', 'warn', 'kick'];
    const [x, y] = c.args.map((v) => (v || '').toLowerCase());
    const g = db().getGroup(c.from);
    if (modes.includes(x)) {
      g.sanction = x; db().saveGroup(c.from, g);
      return c.reply(ui.frame('SANCTION', [kv('PAR DÉFAUT', x.toUpperCase())]));
    }
    if (keys.includes(x) && y === 'default') {
      delete g.sanctions[x]; db().saveGroup(c.from, g);
      return c.reply(ui.frame('SANCTION', [kv(x.toUpperCase(), 'PAR DÉFAUT RÉTABLIE')]));
    }
    if (keys.includes(x) && modes.includes(y)) {
      g.sanctions[x] = y; db().saveGroup(c.from, g);
      return c.reply(ui.frame('SANCTION', [kv(x.toUpperCase(), y.toUpperCase())]));
    }
    return c.reply(ui.error([`UTILISATION : ${c.prefix}sanction delete|warn|kick`, `OU : ${c.prefix}sanction <protection> delete|warn|kick|default`]));
  },
});

cmd({
  name: 'onwarnlimit', admin: true, desc: 'Action au seuil de warns : kick | mute',
  async run(c) {
    const a = (c.args[0] || '').toLowerCase();
    if (!['kick', 'mute'].includes(a)) return usage(c, 'onwarnlimit kick|mute');
    const g = db().getGroup(c.from); g.onWarnLimit = a; db().saveGroup(c.from, g);
    return c.reply(ui.frame('WARN LIMIT', [kv('AU SEUIL', a.toUpperCase())]));
  },
});

cmd({
  name: 'addbad', admin: true, desc: 'Ajouter un mot interdit',
  async run(c) {
    const w = c.args.join(' ').trim().toLowerCase();
    if (!w) return usage(c, 'addbad <mot>');
    const g = db().getGroup(c.from);
    if (!g.badWords.includes(w)) g.badWords.push(w);
    db().saveGroup(c.from, g);
    return c.reply(ui.frame('ANTI-BAD', ['➕ MOT AJOUTÉ', kv('TOTAL', g.badWords.length)]));
  },
});
cmd({
  name: 'delbad', admin: true, desc: 'Retirer un mot interdit',
  async run(c) {
    const w = c.args.join(' ').trim().toLowerCase();
    if (!w) return usage(c, 'delbad <mot>');
    const g = db().getGroup(c.from);
    g.badWords = g.badWords.filter((x) => x !== w);
    db().saveGroup(c.from, g);
    return c.reply(ui.frame('ANTI-BAD', ['➖ MOT RETIRÉ', kv('RESTANTS', g.badWords.length)]));
  },
});

cmd({
  name: 'linkallow', admin: true, desc: 'Domaines autorisés : linkallow add|del|list <domaine>',
  async run(c) {
    const a = (c.args[0] || '').toLowerCase();
    const d = (c.args[1] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const g = db().getGroup(c.from);
    if (a === 'add' && d) { if (!g.linkWhitelist.includes(d)) g.linkWhitelist.push(d); }
    else if (a === 'del' && d) g.linkWhitelist = g.linkWhitelist.filter((x) => x !== d);
    else if (a !== 'list') return usage(c, 'linkallow add|del|list <domaine>');
    db().saveGroup(c.from, g);
    return c.reply(ui.frame('LIENS AUTORISÉS', [g.linkWhitelist.join(', ') || '—']));
  },
});

// ── Mode nuit ────────────────────────────────────────────────
cmd({
  name: 'nightmode', aliases: ['modenuit'], admin: true, desc: 'Fermer le groupe la nuit on/off',
  async run(c) {
    const g = db().getGroup(c.from);
    const arg = c.args[0];
    let val = parseSwitch(arg);
    if (arg && val === null) return usage(c, 'nightmode on|off');
    if (val === null) val = !g.nightMode;
    g.nightMode = val;
    if (!val) g.nightClosed = false;
    db().saveGroup(c.from, g);
    const lines = [`🌙 ${kv('ÉTAT', val ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌')}`, kv('FENÊTRE', `${g.nightStart} → ${g.nightEnd}`)];
    if (val && !c.botAdmin) lines.push('⚠️ BOT NON ADMIN : PROMOUVEZ-LE POUR QUE LA FERMETURE FONCTIONNE');
    return c.reply(ui.frame('MODE NUIT', lines));
  },
});

cmd({
  name: 'nightset', admin: true, desc: 'Horaires du mode nuit : nightset 22:00 06:00',
  async run(c) {
    const s = c.args[0], e = c.args[1];
    if (nightmode.toMin(s) === null || nightmode.toMin(e) === null || nightmode.toMin(s) === nightmode.toMin(e)) return usage(c, 'nightset 22:00 06:00');
    const g = db().getGroup(c.from);
    g.nightStart = s.padStart(5, '0'); g.nightEnd = e.padStart(5, '0'); db().saveGroup(c.from, g);
    return c.reply(ui.frame('MODE NUIT', [kv('FENÊTRE', `${g.nightStart} → ${g.nightEnd}`), kv('FUSEAU', require('../config').timezone)]));
  },
});
