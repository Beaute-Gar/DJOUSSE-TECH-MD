'use strict';

const style = require('../../config/style');

module.exports = function enregistrer(env) {
  const { cmd, config, send } = env;
cmd(['owner', 'creator'], { cat: 1, desc: 'Contacter le propriétaire' }, async (ctx) => {
  const n = config.ownerNumber[0];
  if (!n) {
    return ctx.reply(style.renderError([
      'Contact propriétaire non configuré.',
      'Renseignez OWNER_NUMBER dans le fichier .env.',
    ]));
  }
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${config.botOwnerName}\n` +
    `TEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
  await send(ctx.sock, ctx.from, {
    contacts: { displayName: config.botOwnerName, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
