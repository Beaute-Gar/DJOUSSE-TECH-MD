const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'clean',
  aliases: ['clean'],
  category: 'admin',
  desc: 'Nettoie les anciens messages du store',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      const tmpDir = path.join(__dirname, '..', '..', 'tmp');
      if (fs.existsSync(tmpDir)) {
        const files = fs.readdirSync(tmpDir);
        let count = 0;
        for (const file of files) {
          const filePath = path.join(tmpDir, file);
          const stat = fs.statSync(filePath);
          const age = Date.now() - stat.mtimeMs;
          if (age > 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            count++;
          }
        }
        await ctx.react('🧹');
        return ctx.reply(`${count} ancien(s) fichier(s) nettoyé(s) du dossier temporaire.`);
      }
      return ctx.reply('Le dossier temporaire n\'existe pas encore.');
    } catch (err) {
      return ctx.reply('Erreur lors du nettoyage des fichiers.');
    }
  }
};
