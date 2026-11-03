'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['apk', 'apkdl'],
  description: 'Search and download an APK from Aptoide',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, { jid, contextInfo }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, {
        text: style.renderError([
          'Please provide an app name.',
          'Example: .apk whatsapp',
        ]),
        contextInfo,
      }, { quoted: message });
    }

    await sock.sendMessage(jid, {
      text: style.renderInfo([`Searching for *${query}*…`]),
      contextInfo,
    }, { quoted: message });

    try {
      const { data } = await axios.get(
        `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`,
        {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );

      const app = data?.datalist?.list?.[0];
      if (!app) {
        return sock.sendMessage(jid, {
          text: style.renderError([`No APK found for "*${query}*".`]),
          contextInfo,
        }, { quoted: message });
      }

      const sizeMB = (app.size / 1048576).toFixed(2);
      await sock.sendMessage(jid, {
        document: { url: app.file.path_alt },
        fileName: `${app.name}.apk`,
        mimetype: 'application/vnd.android.package-archive',
        caption: style.renderInfo([`📱 *${app.name}* — ${sizeMB} MB`]),
        contextInfo,
      }, { quoted: message });
    } catch (error) {
      console.error('[APK]', error.message);
      await sock.sendMessage(jid, {
        text: style.renderError([
          `APK download failed: ${String(error.message || error).replace(/\s+/g, ' ').slice(0, 250)}`,
        ]),
        contextInfo,
      }, { quoted: message });
    }
  },
};
