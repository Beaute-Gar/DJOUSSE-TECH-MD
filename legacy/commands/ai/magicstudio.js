const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'magic',
  desc: 'Édite une image avec l\'IA',
  category: 'ai',
  filename: __filename,
}, async (conn, m, args, { from, reply, react }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const imageMsg = quoted?.imageMessage || m.message?.imageMessage;
  if (!imageMsg || !args.length) return reply(boxWithFooter('MAGIC STUDIO', [{ cmd: 'magic', desc: 'ajoute des ailes' }]));
  const prompt = args.join(' ');
  try {
    await react('🪄');
    const dl = require('../lib/dl.cjs');
    const buffer = await m.quoted.download();
    const fetch = require('node-fetch');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', buffer, { filename: 'image.png', contentType: 'image/png' });
    form.append('prompt', prompt);
    const res = await fetch('https://api.voidworks.xyz/api/magicstudio', { method: 'POST', body: form });
    const data = await res.json();
    if (data.url) {
      await conn.sendMessage(from, { image: { url: data.url }, caption: box('MAGIC STUDIO', [{ label: 'Prompt', value: prompt }]) });
    } else {
      return reply(boxWithFooter('ERROR', [{ raw: 'L\'édition a pas marché.' }]));
    }
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Magic studio pas dispo.' }]));
  }
});
