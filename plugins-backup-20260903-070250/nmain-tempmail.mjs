import config from '../config.cjs';
import axios from 'axios';

const tempmail = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const args = m.body.slice(prefix.length + cmd.length).trim().split(' ');

  if (!['tempmail', 'tmail', 'tm'].includes(cmd)) return;

  try {
    await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

    const response = await axios.get('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
    const email = response.data[0];

    const text = `📧 *Temporary Email Generated*

📬 *Email:* ${email}

📝 *How to use:*
1. Use this email to sign up
2. Use ${prefix}checkmail to check inbox
3. Email expires after 10 minutes

> Made by DJOUSSE-TECH-MD`;

    await sock.sendMessage(m.from, { text }, { quoted: m });
    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error('Tempmail error:', error);
    m.reply('❌ Failed to generate temporary email');
  }
};

export default tempmail;
