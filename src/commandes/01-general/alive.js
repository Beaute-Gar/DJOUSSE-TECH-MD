'use strict';

const os = require('node:os');
const { performance } = require('node:perf_hooks');
const config = require('../../config/config');
const style = require('../../config/style');
const { formatDuration } = require('../../guard/utils/time');

const TZ = 'Africa/Douala';
const IMAGE_URL = 'https://files.catbox.moe/h6zdty.png';

function formatDate(value, options) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...options }).format(value);
}

module.exports = {
  commands: ['alive', 'bot'],
  description: 'Afficher l’état du bot',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const start = performance.now();
    const ping = (performance.now() - start).toFixed(1);
    const totalRam = (os.totalmem() / 1073741824).toFixed(2);
    const usedRam = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
    const mode = config.publicMode ? 'PUBLIC' : config.selfMode ? 'PRIVATE' : 'STANDARD';
    const owner = config.ownerNumber[0] || 'Non renseigné';
    const now = new Date();
    const date = formatDate(now, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = formatDate(now, { hour: '2-digit', minute: '2-digit', hour12: true });

    const caption = style.renderInfo([
      `🤖 BOT : ${config.botName}`,
      `👑 PROPRIÉTAIRE : +${owner}`,
      `⏱️ DISPONIBILITÉ : ${formatDuration(process.uptime() * 1000)}`,
      `⚡ LATENCE : ${ping} ms`,
      `💾 MÉMOIRE : ${usedRam} / ${totalRam} GB`,
      `🔵 MODE : ${mode}`,
      `🔑 PRÉFIXE : ${config.prefix}`,
      `📅 DATE : ${date}`,
      `🕒 HEURE : ${time}`,
      style.signature(),
    ]);

    try {
      await ctx.safeSend({
        image: { url: process.env.ALIVE_IMG || IMAGE_URL },
        caption,
        contextInfo: ctx.contextInfo,
      }, { quoted: message });
    } catch (error) {
      console.warn('[ALIVE] envoi avec image impossible, repli texte :', error.message);
      await ctx.safeSend({ text: caption, contextInfo: ctx.contextInfo }, { quoted: message });
    }
  },
};
