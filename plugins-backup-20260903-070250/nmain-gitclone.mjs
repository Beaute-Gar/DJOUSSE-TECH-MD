import config from '../config.cjs';
import axios from 'axios';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

const gitclone = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['gitclone', 'git'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}gitclone <github_url>`);
  }

  const match = text.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return m.reply('❌ Invalid GitHub URL');
  }

  const [, owner, repo] = match;

  try {
    await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': 'DJOUSSE-TECH-MD' }
    });

    const data = response.data;
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${data.default_branch}.zip`;

    const zipResponse = await axios.get(zipUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(zipResponse.data);

    await sock.sendMessage(m.from, {
      document: buffer,
      fileName: `${repo}.zip`,
      mimetype: 'application/zip',
      caption: `📦 *${data.full_name}*\n📝 ${data.description || 'No description'}\n⭐ ${data.stargazers_count} stars\n🍴 ${data.forks_count} forks`
    }, { quoted: m });

    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error('GitClone error:', error);
    m.reply('❌ Failed to clone repository');
  }
};

export default gitclone;
