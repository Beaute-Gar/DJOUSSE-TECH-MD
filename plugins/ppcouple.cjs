const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');

cmd({
  pattern: 'ppcouple',
  react: '❤️',
  desc: 'Images de profil couple aléatoires',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const filePath = path.resolve(__dirname, '../mydata/users/ppcauple.json');
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const random = data[Math.floor(Math.random() * data.length)];
    await conn.sendMessage(from, { image: { url: random.male }, caption: '🧑 *FOR MALE*' }, { quoted: m });
    await conn.sendMessage(from, { image: { url: random.female }, caption: '👩 *FOR FEMALE*' }, { quoted: m });
  } catch (err) { reply('⚠️ Impossible de charger les images couple.'); }
});
