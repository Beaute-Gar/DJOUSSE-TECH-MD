const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'gptimage',
  alias: ['aiimg'],
  desc: 'Génère une image avec l\'IA',
  category: 'ai',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  const prompt = args.join(' ');
  if (!prompt) return reply(boxWithFooter('GPTIMAGE', [{ cmd: 'gptimage', desc: 'un chat dans l\'espace' }]));
  try {
    await react('🎨');
    const fetch = require('node-fetch');
    const res = await fetch('https://api.ahmmk.cloud/v1/gptimg?prompt=' + encodeURIComponent(prompt));
    const data = await res.json();
    if (data.url) {
      await conn.sendMessage(from, { image: { url: data.url }, caption: box('IMAGE', [{ label: 'Prompt', value: prompt }]) });
    } else {
      return reply(boxWithFooter('ERROR', [{ raw: 'Pas réussi à générer l\'image.' }]));
    }
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'La génération a pas marché.' }]));
  }
});
