const fs = require('fs');
const path = require('path');

const SUDO_PATH = path.join(__dirname, '../../database/sudo.json');

const loadSudo = () => {
  try {
    if (!fs.existsSync(SUDO_PATH)) {
      fs.writeFileSync(SUDO_PATH, JSON.stringify([], null, 2));
      return [];
    }
    return JSON.parse(fs.readFileSync(SUDO_PATH, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveSudo = (list) => {
  fs.writeFileSync(SUDO_PATH, JSON.stringify(list, null, 2));
};

module.exports = {
  name: 'sudo',
  aliases: ['sudo'],
  category: 'owner',
  desc: 'Gère les utilisateurs sudo',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const sudoList = loadSudo();

    if (!args.length) {
      if (sudoList.length === 0) return ctx.reply('Aucun utilisateur sudo.');
      const list = sudoList.map((s, i) => `${i + 1}. ${s}`).join('\n');
      ctx.reply(`📋 Liste sudo :\n\n${list}\n\nUtilise .sudo add/remove <numéro>`);
      return;
    }

    const action = args[0].toLowerCase();

    if (action === 'add') {
      let user;
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
      } else if (args.length > 1) {
        user = args[1].replace(/[^0-9]/g, '');
      } else {
        return ctx.reply('Mentionne quelqu\'un ou écris le numéro.');
      }
      if (sudoList.includes(user)) return ctx.reply('Déjà sudo.');
      sudoList.push(user);
      saveSudo(sudoList);
      await ctx.react('✅');
      ctx.reply(`${user} ajouté aux sudo.`);
    } else if (action === 'remove') {
      const num = parseInt(args[1]) - 1;
      if (isNaN(num) || num < 0 || num >= sudoList.length) return ctx.reply('Numéro invalide.');
      const removed = sudoList.splice(num, 1);
      saveSudo(sudoList);
      await ctx.react('✅');
      ctx.reply(`${removed[0]} retiré des sudo.`);
    } else {
      ctx.reply('Actions disponibles: add, remove');
    }
  }
};
