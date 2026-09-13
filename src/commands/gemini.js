export const name = 'gemini';
export const aliases = ['vision', 'vois', 'image', 'ocr'];
export const description = 'Analyser une image avec AINORIA (Vision)';
export const category = 'general';
export const level = 'user';
export const cooldown = 15;

export async function handler(sock, m, { text, prefix, reply, jid, isQuoted, quotedMsg }) {
  const question = text.replace(/^\.(gemini|vision|vois|image|ocr)\s*/i, '').trim() || 'Décris cette image';

  let mediaMsg = m;
  let mediaType = null;

  if (m.message?.imageMessage) {
    mediaType = 'image';
  } else if (m.message?.videoMessage) {
    mediaType = 'video';
  } else if (isQuoted && quotedMsg) {
    if (quotedMsg.imageMessage) { mediaType = 'image'; mediaMsg = { message: quotedMsg }; }
    else if (quotedMsg.videoMessage) { mediaType = 'video'; mediaMsg = { message: quotedMsg }; }
  }

  if (!mediaType) {
    return reply(
      `🖼️ *Analyse d'image*\n\n` +
      `Usage: Envoie une image avec ${prefix}gemini [question]\n` +
      `Ou réponds à une image avec ${prefix}gemini\n\n` +
      `Ex: ${prefix}gemini Que contient cette facture ?`
    );
  }

  reply(`🔍 Analyse de l'${mediaType} en cours...`);

  try {
    let buffer;
    if (mediaMsg.message?.imageMessage) {
      buffer = await sock.downloadMediaMessage(mediaMsg);
    } else {
      buffer = await sock.downloadMediaMessage(m);
    }

    const b64 = buffer.toString('base64');

    // Utiliser AINORIA (identité DJOUSSE TECH injectée automatiquement)
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const ainoria = require('../../lib/ainoria.cjs');
    const answer = await ainoria.describeImage(b64, question);
    return reply(`🖼️ *Analyse d'image*\n\n${answer || 'Aucune analyse disponible'}`);
  } catch (err) {
    return reply(`❌ Erreur: ${err.message}`);
  }
}
