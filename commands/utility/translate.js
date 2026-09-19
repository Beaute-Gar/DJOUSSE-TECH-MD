const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'translate',
  alias: ['traduire'],
  desc: 'Traduit du texte',
  category: 'util',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  if (args.length < 2) return reply(box('TRADUCTION', [{ raw: 'Utilisation: .translate <langue> <texte>\nEx: .translate en bonjour' }]));
  const lang = args[0].toLowerCase();
  const text = args.slice(1).join(' ');
  try {
    await react('🌐');
    const fetch = require('node-fetch');
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|${lang}`);
    const data = await res.json();
    if (data.responseData && data.responseData.translatedText) {
      return reply(box('TRADUCTION', [
        { label: 'Langue', value: lang },
        { label: 'Traduction', value: data.responseData.translatedText },
      ]));
    }
    return reply(box('ERROR', [{ raw: 'Traduction pas trouvée.' }]));
  } catch {
    return reply(box('ERROR', [{ raw: 'Erreur lors de la traduction...' }]));
  }
});
