const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BOT_IMAGES = [
    path.join(ASSETS_DIR, 'bot1.png'),
    path.join(ASSETS_DIR, 'bot2.png'),
];
let menuImageIndex = 0;

function getNextMenuImage() {
    const available = BOT_IMAGES.filter(f => fs.existsSync(f));
    if (available.length === 0) return null;
    const img = available[menuImageIndex % available.length];
    menuImageIndex++;
    return img;
}

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
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const ownerName = config.OWNER_NAME || 'DJOUSSE';

    const categories = {};
    for (const [name, cmd] of commands) {
      const cat = cmd.category || 'general';
      if (!categories[cat]) categories[cat] = [];
      if (!categories[cat].find(c => c.name === cmd.name)) {
        categories[cat].push(cmd);
      }
    }

    let text = `╭━━『 ${botName} 』━━╮\n`;
    text += `│ 👋 Hello @${msg.sender.split('@')[0]}!\n`;
    text += `│\n`;
    text += `│ ⚡ Prefix: ${config.prefix}\n`;
    text += `│ 📦 Total Commands: ${commands.size}\n`;
    text += `│ 👑 Owner: ${ownerName}\n`;
    text += `│ 🤖 BOT: https://github.com/Beaute-Gar/DJOUSSE-TECH-MD\n`;
    text += `│\n`;

    const catEmojis = {
        general: '🧭', ai: '🤖', anime: '👾', fun: '🎭', game: '🎮',
        economy: '💰', admin: '🛡️', owner: '👑', media: '🎞️',
        tool: '🔧', convert: '🔄', sticker: '🎨', textmaker: '🖋️',
        security: '🔒', group: '👥', info: 'ℹ️', utility: '⚙️', main: '🏠'
    };

    const catOrder = ['general', 'ai', 'admin', 'owner', 'media', 'fun', 'economy', 'game', 'anime', 'utility', 'tool', 'convert', 'sticker', 'textmaker', 'security', 'group', 'info', 'main'];

    for (const cat of catOrder) {
      if (!categories[cat]) continue;
      const emoji = catEmojis[cat] || '📁';
      text += `┏━━━━━━━━━━━━━━━━━\n`;
      text += `┃ ${emoji} ${cat.toUpperCase()} COMMAND\n`;
      text += `┗━━━━━━━━━━━━━━━━━\n`;
      for (const cmd of categories[cat]) {
        text += `│ ➜ ${config.prefix}${cmd.name}\n`;
      }
    }

    for (const [cat, cmds] of Object.entries(categories)) {
      if (!catOrder.includes(cat)) {
        const emoji = catEmojis[cat] || '📁';
        text += `┏━━━━━━━━━━━━━━━━━\n`;
        text += `┃ ${emoji} ${cat.toUpperCase()} COMMAND\n`;
        text += `┗━━━━━━━━━━━━━━━━━\n`;
        for (const cmd of cmds) {
          text += `│ ➜ ${config.prefix}${cmd.name}\n`;
        }
      }
    }

    text += `\n╰━━━━━━━━━━━━━━━━━\n`;
    text += `💡 Type ${config.prefix}help <command> for more info\n`;
    text += `🌟 Bot Version: 1.0.0`;

    const imgPath = getNextMenuImage();
    try {
      if (imgPath) {
        await sock.sendMessage(msg.chat, { image: { url: imgPath }, caption: text, mentions: [msg.sender] }, { quoted: msg });
      } else {
        await ctx.reply(text);
      }
    } catch (_) {
      await ctx.reply(text);
    }
  }
};
