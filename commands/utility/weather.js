const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'weather',
  alias: ['meteo'],
  desc: 'Météo d\'une ville',
  category: 'util',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  if (!args.length) return reply(box('MÉTÉO', [{ raw: 'Écris le nom de la ville.\nEx: .weather Douala' }]));
  const city = args.join(' ');
  try {
    await react('🌤️');
    const fetch = require('node-fetch');
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w&lang=fr`);
    const text = await res.text();
    return reply(box(`MÉTÉO — ${city}`, [
      { raw: text },
    ]));
  } catch {
    return reply(box('ERROR', [{ raw: 'Erreur lors de la récupération de la météo...' }]));
  }
});
