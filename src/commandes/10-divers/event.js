'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, parseFrDate, send } = env;
cmd('event', ['rdv'], { cat: 10, desc: 'Créer un événement WhatsApp', usage: 'event <titre> | <lieu> | <JJ/MM/AAAA HH:MM> | <description>' }, async (ctx) => {
  const parts = ctx.q.split('|').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) {
    return ctx.reply(`❌ Usage : ${config.prefix}event Réunion | Salle A | 28/09/2026 18:00 | Ordre du jour`);
  }
  const name = parts.shift().slice(0, 100);
  let startSec = null;
  for (let i = 0; i < parts.length; i++) {
    const d = parseFrDate(parts[i]);
    if (d) {
      startSec = Math.floor(d.getTime() / 1000);
      parts.splice(i, 1);
      break;
    }
  }
  const place = parts.shift() || '';
  const description = [place ? `📍 ${place}` : '', parts.join('\n')]
    .filter(Boolean)
    .join('\n')
    .slice(0, 300);
  if (startSec == null) startSec = Math.floor(Date.now() / 1000) + 86400;
  await send(ctx.sock, ctx.from, {
    event: { name, description, startTime: startSec },
  }, { quoted: ctx.msg });
  const when = new Date(startSec * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  await ctx.reply(`📅 Événement « ${name} » créé pour le ${when}.`);
});
};
module.exports.maison = true;
