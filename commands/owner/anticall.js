const fs = require('fs');
const path = require('path');

const ANTICALL_PATH = path.join(__dirname, '../../database/anticall.json');

const loadConfig = () => {
  try {
    if (!fs.existsSync(ANTICALL_PATH)) {
      fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: false }, null, 2));
      return { enabled: false };
    }
    return JSON.parse(fs.readFileSync(ANTICALL_PATH, 'utf-8'));
  } catch (e) {
    return { enabled: false };
  }
};

const saveConfig = (data) => {
  fs.writeFileSync(ANTICALL_PATH, JSON.stringify(data, null, 2));
};

module.exports = {
  name: 'anticall',
  aliases: ['anticall'],
  category: 'owner',
  desc: 'Active/désactive le rejet automatique des appels',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const config = loadConfig();
    config.enabled = !config.enabled;
    saveConfig(config);
    await ctx.react(config.enabled ? '✅' : '❌');
    ctx.reply(`Rejet automatique des appels : ${config.enabled ? 'Activé' : 'Désactivé'}`);
  }
};
