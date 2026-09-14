module.exports = {
  name: 'getpp',
  aliases: ['getpp', 'pp'],
  category: 'general',
  desc: 'Récupère la photo de profil',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    try {
      await ctx.react('📷');
      let target = ctx.sender;
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quoted) target = quoted;

      const ppUrl = await sock.profilePictureUrl(target, 'image');
      await sock.sendMessage(ctx.from, { image: { url: ppUrl }, caption: `Photo de profil de @${target.split('@')[0]}`, mentions: [target] });
    } catch (e) {
      await ctx.reply('J\'ai pas réussi à récupérer la photo. Soit y en a pas, soit j\'ai pas accès.');
    }
  }
};
