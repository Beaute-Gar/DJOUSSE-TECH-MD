'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, send } = env;
cmd('owner', { cat: 1, desc: 'Contacter le propriétaire' }, async (ctx) => {
  const n = config.ownerNumber[0];
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${config.botOwnerName}\n` +
    `TEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
  await send(ctx.sock, ctx.from, {
    contacts: { displayName: config.botOwnerName, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
