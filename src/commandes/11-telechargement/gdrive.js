'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['gdrive', 'googledrive', 'gdl'],
  description: 'Get direct download link from Google Drive',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, { sender, contextInfo }) => {
    const url = args[0];
    if (!url || !url.includes('drive.google.com')) {
      return sock.sendMessage(sender, {
        text: `${style.renderSaisie('Please provide a Google Drive URL.')}\nExample: .gdrive https://drive.google.com/file/d/FILE_ID/view`,
        contextInfo,
      }, { quoted: message });
    }

    try {
      const idMatch = url.match(/[-\w]{25,}/);
      if (!idMatch) throw new Error('Could not extract file ID.');
      const fileId = idMatch[0];
      const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const confirmLink = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
      const { headers } = await axios.head(downloadLink, { timeout: 10000, maxRedirects: 3 });
      const fileName = (headers['content-disposition'] || '').match(/filename="?([^"]+)"?/)?.[1] || fileId;
      const size = headers['content-length']
        ? `${(parseInt(headers['content-length']) / 1024 / 1024).toFixed(2)} MB`
        : 'Unknown';

      await sock.sendMessage(sender, {
        text: `${style.renderInfo([
          '📁 Google Drive File',
          '',
          `📄 Name: ${fileName}`,
          `📦 Size: ${size}`,
        ])}\n🔗 Download: ${confirmLink}\n_Powered by DJOUSSE TECH_`,
        contextInfo,
      }, { quoted: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: style.renderError([`Google Drive failed: ${error.message}`]),
        contextInfo,
      }, { quoted: message });
    }
  },
};
