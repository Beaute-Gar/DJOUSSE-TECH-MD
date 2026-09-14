const database = require('../../database');

module.exports = {
  name: 'groupstatus',
  aliases: ['groupstatus', 'gs'],
  category: 'admin',
  desc: 'Affiche les paramètres du groupe',
  ownerOnly: false,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const s = database.getGroupSettings(ctx.from);

    const on = 'Actif';
    const off = 'Inactif';

    const lines = [
      'Paramètres du groupe:',
      '',
      'Protections:',
      `- Antilink: ${s.antilink ? on : off}`,
      `- Antibadword: ${s.antibadword ? on : off}`,
      `- Antitag: ${s.antitag ? on : off}`,
      `- Antisticker: ${s.antisticker ? on : off}`,
      `- Antibot: ${s.antibot ? on : off}`,
      `- Antimention: ${s.antigroupmention ? on : off}`,
      `- Antistatus: ${s.antigroupstatus ? on : off}`,
      '',
      'Messages:',
      `- Bienvenue: ${s.welcome ? on : off}`,
      `- Au revoir: ${s.goodbye ? on : off}`,
      '',
      'Fonctions:',
      `- Chatbot: ${s.chatbot ? on : off}`,
      `- Autosticker: ${s.autosticker ? on : off}`,
    ];

    return ctx.reply(lines.join('\n'));
  }
};
