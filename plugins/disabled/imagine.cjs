const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'imagine', desc: 'Générer une image par IA (prompt)', category: 'media', filename: __filename }, async (conn, m, commands, config) => {
const prompt = m.body.split(' ').slice(1).join(' ');
if (!prompt) return m.reply(box('🎨 *IMAGE GÉNÉRÉE*', [
  { raw: 'Utilisation :' },
  { raw: '.imagine <prompt>' },
  { blank: true },
  { raw: 'Exemple :' },
  { raw: '.imagine un chat volant dans l\'espace' },
]));
const api = `https://pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
const caption = box('🎨 *IMAGE GÉNÉRÉE*', [
  { label: 'Prompt', value: `_${truncate(prompt, 80)}_` },
  { label: 'Modèle', value: '*Pollinations AI*' },
]);
await conn.sendMessage(m.chat, { image: { url: api }, caption }, { quoted: m });
});