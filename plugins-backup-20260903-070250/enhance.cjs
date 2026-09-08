const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
const { fetchJson } = require('../lib/functions.cjs');
cmd({ pattern: 'enhance', desc: 'Améliorer la qualité d\'une image', category: 'media', filename: __filename }, async (conn, m, commands, config) => {
if (!m.quoted?.msg?.imageMessage) return m.reply('❌ Réponds à une image avec .enhance');
const img = await downloadMediaMessage(m.quoted, 'input');
if (!img) return m.reply('❌ Erreur téléchargement.');
const b64 = img.toString('base64');
const result = await fetchJson('https://api.deepai.org/api/colorizer', { method: 'POST', headers: { 'api-key': 'try-it' }, body: { image: b64 } }).catch(() => null);
if (result?.output_url) {
const enhanced = await require('../lib/functions.cjs').getBuffer(result.output_url);
return m.replyImg(enhanced, '✨ Image améliorée !');
}
m.reply('❌ Service d\'amélioration indisponible pour le moment.');
});