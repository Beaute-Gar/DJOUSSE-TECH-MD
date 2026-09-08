export const name = 'gemini';
export const aliases = ['vision', 'vois', 'image', 'ocr'];
export const description = 'Analyser une image avec l\'IA (Gemini Vision)';
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
    const mime = mediaMsg.message?.imageMessage?.mimetype || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reply('❌ GEMINI_API_KEY non configurée');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: question }
          ]
        }]
      })
    });

    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Aucune analyse disponible';
    return reply(`🖼️ *Analyse d'image*\n\n${answer}`);
  } catch (err) {
    return reply(`❌ Erreur: ${err.message}`);
  }
}
