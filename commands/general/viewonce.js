module.exports = {
  name: 'viewonce',
  aliases: ['viewonce', 'vo'],
  category: 'general',
  desc: 'Récupère les view-once',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    if (!quoted) {
      return await ctx.reply('Réponds à un message view-once pour le récupérer.');
    }
    const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
    if (!viewOnce) {
      return await ctx.reply('C pas un message view-once ça.');
    }
    try {
      await ctx.react('👁️');
      const type = Object.keys(viewOnce).find(k => k === 'imageMessage' || k === 'videoMessage');
      if (!type) {
        return await ctx.reply('Type de média non supporté.');
      }
      const mediaMsg = viewOnce[type];
      const stream = await sock.downloadMediaMessage({ message: { [type]: mediaMsg } });
      const buffer = Buffer.from(stream);
      const caption = mediaMsg.caption || 'View once récupéré';
      if (type === 'imageMessage') {
        await sock.sendMessage(ctx.from, { image: buffer, caption });
      } else {
        await sock.sendMessage(ctx.from, { video: buffer, caption });
      }
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas réussi à récupérer le view-once.');
    }
  }
};
