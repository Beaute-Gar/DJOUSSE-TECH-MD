'use strict';
const { cmd } = require('./registry');
const { db } = require('../db');
const ui = require('../ui');
const { kv, parseSwitch } = ui;

cmd({
  name: 'antifake', admin: true, desc: 'Expulser les arrivants hors indicatifs autorisés',
  async run(c) {
    const g = db().getGroup(c.from);
    const arg = c.args[0];
    let val = parseSwitch(arg);
    if (arg && val === null) return c.reply(ui.error([`UTILISATION : ${c.prefix}antifake on|off`]));
    if (val === null) val = !g.antifake;
    if (val && !g.allowedCodes.length) g.allowedCodes = ['237'];
    g.antifake = val; db().saveGroup(c.from, g);
    const lines = [`🧬 ${kv('ÉTAT', val ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌')}`];
    if (val) lines.push(kv('INDICATIFS', g.allowedCodes.join(', ')), `MODIFIER : ${c.prefix}allowcodes 237 33 241`);
    if (val && !c.botAdmin) lines.push('⚠️ BOT NON ADMIN : PROMOUVEZ-LE POUR EXPULSER');
    return c.reply(ui.frame('ANTI-FAKE', lines));
  },
});

cmd({
  name: 'allowcodes', admin: true, desc: 'Indicatifs pays autorisés : allowcodes 237 33',
  async run(c) {
    const codes = c.args.map((x) => x.replace(/\D/g, '')).filter(Boolean);
    if (!codes.length) return c.reply(ui.error([`UTILISATION : ${c.prefix}allowcodes 237 33 241`]));
    const g = db().getGroup(c.from); g.allowedCodes = codes; db().saveGroup(c.from, g);
    return c.reply(ui.frame('ANTI-FAKE', [kv('INDICATIFS', codes.join(', '))]));
  },
});
