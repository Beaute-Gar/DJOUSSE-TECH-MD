const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   COUPLE PROFILE PICTURES
   Uses picsum.photos (free, no key, unlimited) to generate random
   matching couple profile pictures. Two images served as a pair.
   ═══════════════════════════════════════════════════════════════════════════ */

const COUPLE_IMAGES = [
  { male: 'https://picsum.photos/id/1005/400/400', female: 'https://picsum.photos/id/1027/400/400' },
  { male: 'https://picsum.photos/id/1012/400/400', female: 'https://picsum.photos/id/1024/400/400' },
  { male: 'https://picsum.photos/id/1015/400/400', female: 'https://picsum.photos/id/1025/400/400' },
  { male: 'https://picsum.photos/id/1019/400/400', female: 'https://picsum.photos/id/1028/400/400' },
  { male: 'https://picsum.photos/id/1027/400/400', female: 'https://picsum.photos/id/1005/400/400' },
  { male: 'https://picsum.photos/id/64/400/400',   female: 'https://picsum.photos/id/65/400/400' },
  { male: 'https://picsum.photos/id/91/400/400',   female: 'https://picsum.photos/id/94/400/400' },
  { male: 'https://picsum.photos/id/177/400/400',  female: 'https://picsum.photos/id/160/400/400' },
  { male: 'https://picsum.photos/id/237/400/400',  female: 'https://picsum.photos/id/238/400/400' },
  { male: 'https://picsum.photos/id/342/400/400',  female: 'https://picsum.photos/id/349/400/400' },
];

cmd({
  pattern: 'ppcouple',
  react: '❤️',
  desc: 'Images de profil couple aléatoires',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    await m.react('❤️').catch(() => {});
    const pair = COUPLE_IMAGES[Math.floor(Math.random() * COUPLE_IMAGES.length)];
    await conn.sendMessage(from, { image: { url: pair.male }, caption: '┌───[ 🧑 *POUR LUI* ]\n│  _Made by DJOUSSE-TECH-MD_\n└───────' }, { quoted: m });
    await conn.sendMessage(from, { image: { url: pair.female }, caption: '┌───[ 👩 *POUR ELLE* ]\n│  _Made by DJOUSSE-TECH-MD_\n└───────' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (err) {
    await m.react('❌').catch(() => {});
    reply(boxWithFooter('❌ *ERREUR*', [{ raw: truncate(err.message, 200) }]));
  }
});
