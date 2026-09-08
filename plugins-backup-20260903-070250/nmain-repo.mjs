import config from '../config.cjs';
import axios from 'axios';

const repo = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (!['repo', 'sc', 'script'].includes(cmd)) return;

  try {
    const response = await axios.get('https://api.github.com/repos/Beaute-Gar/DJOUSSE-TECH-MD');
    const data = response.data;

    const text = `📦 *DJOUSSE-TECH-MD REPOSITORY*

🔗 *URL:* ${data.html_url}
📝 *Description:* ${data.description || 'N/A'}
⭐ *Stars:* ${data.stargazers_count}
🍴 *Forks:* ${data.forks_count}
👀 *Watchers:* ${data.watchers_count}
📅 *Created:* ${new Date(data.created_at).toLocaleDateString()}
🔄 *Last Updated:* ${new Date(data.updated_at).toLocaleDateString()}
📋 *Language:* ${data.language || 'N/A'}
📜 *License:* ${data.license?.name || 'N/A'}

> Made by DJOUSSE TECH EVOLUTION`;

    await sock.sendMessage(m.from, { text }, { quoted: m });

  } catch (error) {
    console.error('Repo error:', error);
    m.reply('❌ Failed to fetch repository info');
  }
};

export default repo;
