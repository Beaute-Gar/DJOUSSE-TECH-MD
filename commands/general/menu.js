const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'menu',
  aliases: ['menu', 'help', 'list'],
  category: 'general',
  desc: 'Affiche le menu des commandes',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const commands = loadCommands();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const uptimeStr = `${h}h ${m}m ${s}s`;

    const categories = {};
    for (const [name, cmd] of commands) {
      const cat = cmd.category || 'general';
      if (!categories[cat]) categories[cat] = [];
      if (!categories[cat].find(c => c.name === cmd.name)) {
        categories[cat].push(cmd);
      }
    }

    let text = `*${config.botName}*\n`;
    text += `Prefixe: ${config.prefix}\n`;
    text += `Commandes: ${commands.size}\n`;
    text += `Uptime: ${uptimeStr}\n\n`;

    const catOrder = ['general', 'ai', 'anime', 'fun', 'tools', 'convert', 'admin', 'owner'];
    for (const cat of catOrder) {
      if (!categories[cat]) continue;
      text += `*${cat.toUpperCase()}*\n`;
      for (const cmd of categories[cat]) {
        text += `${config.prefix}${cmd.name} - ${cmd.desc || 'Pas de description'}\n`;
      }
      text += '\n';
    }

    for (const [cat, cmds] of Object.entries(categories)) {
      if (!catOrder.includes(cat)) {
        text += `*${cat.toUpperCase()}*\n`;
        for (const cmd of cmds) {
          text += `${config.prefix}${cmd.name} - ${cmd.desc || 'Pas de description'}\n`;
        }
        text += '\n';
      }
    }

    await ctx.reply(text.trim());
  }
};
