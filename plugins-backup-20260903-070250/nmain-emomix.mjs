import config from '../config.cjs';
import axios from 'axios';

const emomix = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['emomix', 'emoji'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}emomix <emoji1> <emoji2>\nExample: ${prefix}emomix 🔥 ❤️`);
  }

  const emojis = text.split(/\s+/).slice(0, 2);
  if (emojis.length < 2) {
    return m.reply('❌ Please provide 2 emojis');
  }

  try {
    await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

    const emoji1 = encodeURIComponent(emojis[0]);
    const emoji2 = encodeURIComponent(emojis[1]);
    const imageUrl = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${emoji1}_${emoji2}`;

    await sock.sendMessage(m.from, {
      image: { url: imageUrl },
      caption: `🎨 *Emoji Mix*\n\n${emojis[0]} + ${emojis[1]} = ✨\n\n> Made by DJOUSSE-TECH-MD`
    }, { quoted: m });

    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error('Emomix error:', error);
    m.reply('❌ Failed to mix emojis');
  }
};

export default emomix;
