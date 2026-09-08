import config from '../config.cjs';
import axios from 'axios';

const qura = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['quran', 'qura', 'ayat'].includes(cmd)) return;

  try {
    await sock.sendMessage(m.from, { react: { text: '📖', key: m.key } });

    let surah, ayat;
    if (text) {
      const parts = text.split(':');
      surah = parseInt(parts[0]);
      ayat = parts[1] ? parseInt(parts[1]) : null;
    } else {
      surah = Math.floor(Math.random() * 114) + 1;
      ayat = null;
    }

    if (!surah || surah < 1 || surah > 114) {
      return m.reply('❌ Invalid surah number (1-114)');
    }

    const response = await axios.get(`https://api.alquran.cloud/v1/surah/${surah}`);
    const surahData = response.data.data;

    const text_ayat = ayat ? `\n📖 Ayat: ${ayat}` : '';

    const info = `🕌 *${surahData.englishName}*\n\n📝 *Arabic Name:* ${surahData.name}\n🔢 *Number:* ${surahData.number}\n📊 *Total Ayat:* ${surahData.numberOfAyahs}\n📚 *Revelation:* ${surahData.revelationType}${text_ayat}\n\n> Made by DJOUSSE-TECH-MD`;

    await sock.sendMessage(m.from, { text: info }, { quoted: m });
    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error('Quran error:', error);
    m.reply('❌ Failed to fetch Quran info');
  }
};

export default qura;
