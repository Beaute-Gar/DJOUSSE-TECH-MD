const { cmd } = require('../command.cjs');

cmd({
  pattern: 'trt',
  alias: ['translate'],
  react: '🌍',
  desc: 'Traduire texte ou texte d\'image',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply('❌ Utilisation: .trt <langue> <texte>');
  const targetLang = q.split(' ')[0];
  const text = q.split(' ').slice(1).join(' ');
  try {
    await m.react('🌍').catch(() => {});
    const translate = require('translate-google-api');
    if (m.quoted && m.quoted.mtype === 'imageMessage') {
      const Tesseract = require('tesseract.js');
      const { writeFile } = require('fs/promises');
      const media = await m.quoted.download();
      const filePath = './' + Date.now() + '.png';
      await writeFile(filePath, media);
      const { data: { text: extractedText } } = await Tesseract.recognize(filePath, 'eng');
      const result = await translate(extractedText, { to: targetLang });
      reply('🌍 *' + targetLang + ':*\n\n' + result[0]);
    } else if (text) {
      const result = await translate(text, { to: targetLang });
      reply('🌍 *' + targetLang + ':*\n\n' + result[0]);
    } else { reply('❌ Fournis du texte ou réponds à un message.'); }
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur: ' + error.message); }
});
