import fs from 'fs';
import path from 'path';
import config from '../config.cjs';

const ppcoupleCmd = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase()
    : '';

  if (cmd !== 'ppcouple') return;

  const filePath = path.resolve('../../mydata/users/ppcauple.json');

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read ppcouple JSON:', err);
    await sock.sendMessage(m.from, { text: 'âš ï¸ Failed to load couple images.' }, { quoted: m });
    return;
  }

  const random = data[Math.floor(Math.random() * data.length)];
  const caption = 'á´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE';

  try {
    await sock.sendMessage(m.from, {
      image: { url: random.male },
      caption: `for ðŸ‘¦ Male`,
      contextInfo: {
        externalAdReply: {
          title: "inconnu xá´… v2",
          body: caption,
          thumbnailUrl: 'https://files.catbox.moe/e1k73u.jpg',
          sourceUrl: 'https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R',
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: m });

    await sock.sendMessage(m.from, {
      image: { url: random.female },
      caption: `for ðŸ‘§ Female`,
      contextInfo: {
        externalAdReply: {
          title: "inconnu xá´… v2",
          body: caption,
          thumbnailUrl: 'https://files.catbox.moe/e1k73u.jpg',
          sourceUrl: 'https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R',
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: m });

  } catch (err) {
    console.error('Failed to send images:', err);
  }
};

export default ppcoupleCmd;
      

