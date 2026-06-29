export const name = 'nomcommande';
export const aliases = ['nc'];
export const description = 'Décris ce que fait la commande ici';
export const category = 'info';
export const level = 'user';

export async function handler(sock, m, { args, text, prefix, config, isGroup, privilege }) {
  if (!text) {
    return m.reply(`*Usage :* ${prefix}${name} <argument>\n*Exemple :* ${prefix}${name} bonjour`);
  }
  try {
    await m.reply(`Tu as écrit : ${text}`);
  } catch (err) {
    await m.reply(`❌ Erreur dans ${name} : ${err.message}`);
  }
}
