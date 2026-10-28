'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, ctxInfo, num, send } = env;
cmd('vcard', ['contact'], { cat: 10, desc: 'Envoyer une carte de contact', usage: 'vcard <numéro> [@mention] [nom]' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const number =
    (ci?.mentionedJid || []).map((j) => num(j)).find(Boolean) ||
    (ctx.q.match(/\d{5,}/) || [])[0];
  if (!number) return ctx.reply(`❌ Usage : ${config.prefix}vcard 237690000000 Nom`);
  const name = ctx.q.replace(/\d{5,}/, '').replace(/@\d+/g, '').trim() || `+${number}`;
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\n` +
    `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
  await send(ctx.sock, ctx.from, {
    contacts: { displayName: name, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
