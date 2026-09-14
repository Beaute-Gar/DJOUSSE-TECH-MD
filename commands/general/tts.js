const { textToSpeech } = require('../../utils/tts');

module.exports = {
  name: 'tts',
  aliases: ['tts', 'say'],
  category: 'general',
  desc: 'Convertit le texte en audio',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return await ctx.reply('Écris un texte pour que je le lise.');
    }
    try {
      await ctx.react('🔊');
      const audioPath = await textToSpeech(text);
      if (!audioPath) {
        return await ctx.reply('J\'ai pas réussi à générer l\'audio.');
      }
      await sock.sendMessage(ctx.from, {
        audio: require('fs').readFileSync(audioPath),
        mimetype: 'audio/mpeg',
        ptt: true
      });
      require('fs').unlinkSync(audioPath);
    } catch (e) {
      await ctx.reply('Oups, problème avec le TTS.');
    }
  }
};
