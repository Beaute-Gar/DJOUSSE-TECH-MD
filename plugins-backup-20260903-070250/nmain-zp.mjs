import config from '../config.cjs';

const zp = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['zp', 'quote', 'quotecard'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}zp <text>\nExample: ${prefix}zp Life is what happens`);
  }

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const canvas = `╭━━━〔 *QUOTE CARD* 〕━━━╮
┃
┃ 🎨 *Color:* ${randomColor}
┃ 📝 *Text:*
┃
┃ _"${text}"_
┃
┃ ✨ *— DJOUSSE-TECH-MD*
╰━━━━━━━━━━━━━━━━━━━━━╯`;

  await sock.sendMessage(m.from, { text: canvas }, { quoted: m });
};

export default zp;
