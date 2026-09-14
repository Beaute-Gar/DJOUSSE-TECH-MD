const config = require('../../config');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  name: 'update',
  aliases: ['update'],
  category: 'owner',
  desc: 'Met à jour le bot depuis GitHub',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('🔄');
      ctx.reply('Téléchargement de la mise à jour...');

      const zipUrl = config.updateZipUrl;
      if (!zipUrl) return ctx.reply('URL de mise à jour non configurée.');

      const res = await fetch(zipUrl);
      if (!res.ok) return ctx.reply('Erreur lors du téléchargement...');

      const buffer = await res.buffer();
      const tmpPath = path.join(__dirname, '../../tmp/update.zip');
      fs.writeFileSync(tmpPath, buffer);

      ctx.reply('Extraction en cours...');

      exec(`cd "${path.join(__dirname, '../..')}" && tar -xf tmp/update.zip --strip-components=1`, (err) => {
        if (err) {
          ctx.reply('Erreur lors de l\'extraction...');
          return;
        }
        ctx.reply('Mise à jour installée ! Redémarrage...');
        setTimeout(() => process.exit(0), 2000);
      });
    } catch (e) {
      ctx.reply('Erreur lors de la mise à jour...');
    }
  }
};
