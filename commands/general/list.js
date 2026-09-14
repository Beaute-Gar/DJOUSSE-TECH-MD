const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'list',
  aliases: ['list', 'commands'],
  category: 'general',
  desc: 'Liste toutes les commandes',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const commands = loadCommands();
    const categories = {};
    for (const [name, cmd] of commands) {
      const cat = cmd.category || 'general';
      if (!categories[cat]) categories[cat] = [];
      if (!categories[cat].find(c => c.name === cmd.name)) {
        categories[cat].push(cmd);
      }
    }

    let text = `*${config.botName} - Liste des commandes*\n\n`;
    for (const [cat, cmds] of Object.entries(categories).sort()) {
      text += `*${cat.toUpperCase()}* (${cmds.length})\n`;
      for (const cmd of cmds) {
        text += `${config.prefix}${cmd.name}\n`;
      }
      text += '\n';
    }
    text += `Total: ${commands.size} commandes`;
    await ctx.reply(text.trim());
  }
};
