'use strict';

module.exports = function enregistrer(env) {
  const { MSG_NO_KEY, aiUserMessage, askAI, cmd, config, downloadFrom, hasAIKey, mediaInfo } = env;
cmd('analyse', ['ocr'], { cat: 6, desc: 'IA : lire une image, transcrire un vocal, résumer un document', usage: 'analyse [question] (réponds à un média)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info) return ctx.reply(`❌ Réponds à une image, un vocal ou un document.\nUsage : ${config.prefix}analyse`);
  if (!hasAIKey()) return ctx.reply(MSG_NO_KEY);

  const kind = info.type;
  const prompts = {
    imageMessage: 'Transcris tout le texte visible en français. S’il n’y a pas de texte, décris l’image en 3 phrases.',
    audioMessage: 'Transcris cet audio en français, fidèlement, avec la ponctuation.',
    documentMessage: 'Résume ce document en 5 points maximum, en français.',
    videoMessage: 'Décris brièvement cette vidéo en 3 phrases.',
  };
  if (!prompts[kind]) return ctx.reply('❌ Média non pris en charge (image, vocal, document, vidéo).');

  const mime = (info.mimetype || '').split(';')[0].trim().toLowerCase();
  if (kind === 'documentMessage' && !/pdf|text\/plain/.test(mime)) {
    return ctx.reply('❌ Documents pris en charge : PDF et texte brut seulement.');
  }
  if (kind === 'videoMessage' && !/^video\/(mp4|webm)$/.test(mime)) {
    return ctx.reply('❌ Vidéo prise en charge : MP4 seulement.');
  }

  await ctx.reply(config.messages.wait);
  let buf;
  try {
    buf = await downloadFrom(ctx.sock, info);
  } catch (e) {
    return ctx.reply(`❌ Téléchargement du média impossible : ${e.message}`);
  }
  if (!buf?.length) return ctx.reply('❌ Média vide ou expiré (reproduis le message).');
  if (buf.length > 12 * 1024 * 1024) return ctx.reply('❌ Fichier trop volumineux (> 12 Mo).');

  const prompt = (ctx.q || prompts[kind]).slice(0, 1500);
  try {
    const answer = await askAI(prompt, { mime: mime || 'application/octet-stream', data: buf });
    await ctx.reply(`🧠 *Analyse IA*\n\n${answer.slice(0, 4000)}`);
  } catch (e) {
    await ctx.reply(aiUserMessage(e));
  }
});
};
module.exports.maison = true;
