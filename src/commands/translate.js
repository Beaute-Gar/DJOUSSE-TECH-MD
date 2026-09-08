export const name = 'translate';
export const aliases = ['traduc', 'traduis', 'tr'];
export const description = 'Traduire un texte dans une autre langue';
export const category = 'general';
export const level = 'user';
export const cooldown = 5;

export async function handler(sock, m, { text, prefix, reply, isQuoted }) {
  const parts = text.replace(/^\.(translate|traduc|traduis|tr)\s*/i, '').trim().split(/\s+/);
  const targetLang = /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0]) ? parts.shift().toLowerCase() : 'fr';
  const inputText = parts.join(' ').trim() || (isQuoted ? m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation : null);

  if (!inputText) {
    return reply(
      `🌐 *Traduction*\n\n` +
      `Usage: ${prefix}translate [langue] <texte>\n${prefix}tr en Bonjour le monde\n\n` +
      `_Ou répondre à un message avec ${prefix}translate_`
    );
  }

  reply(`🔄 Traduction en cours...`);

  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(inputText)}`);
    const data = await res.json();
    const result = data?.[0]?.map(r => r?.[0]).filter(Boolean).join('') || 'Aucun résultat';
    reply(`🌐 *Traduction (→ ${targetLang})*\n\n${result}`);
  } catch (err) {
    reply(`❌ Erreur: ${err.message}`);
  }
}
