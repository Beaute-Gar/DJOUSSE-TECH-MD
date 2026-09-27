const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'ai',
  desc: 'Pose une question à l\'IA',
  category: 'ai',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  const text = args.join(' ');
  if (!text) return reply(boxWithFooter('AI', [{ cmd: 'ai', desc: 'C\'est quoi la vie ?' }]));
  try {
    await react('🤖');
    const fetch = require('node-fetch');
    const res = await fetch('https://api.ahmmk.cloud/v1/gpt?message=' + encodeURIComponent(text));
    const data = await res.json();
    if (data.response) return reply(boxWithFooter('AI', [{ raw: data.response }]));
    return reply(boxWithFooter('ERROR', [{ raw: 'L\'IA n\'est pas disponible.' }]));
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Oups, l\'IA est pas dispo.' }]));
  }
});
