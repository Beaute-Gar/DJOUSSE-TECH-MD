export const name = 'profil';
export const aliases = ['profile', 'moi'];
export const category = 'info';
export const desc = 'Affiche ton profil memorise par le Cognitive OS';
export const usage = '.profil';
export const cooldown = 5;

export async function handler(m, ctx) {
  const { getAllMemoryStats } = await import('../cognitive/brain.js');
  const stats = getAllMemoryStats();
  const senderName = ctx.pushName || ctx.senderJid?.split('@')[0] || 'Inconnu';
  const msgCount = stats.totalMessages || 0;

  await m.reply(
    `👤 *Profil Cognitif*\n\n` +
    `Nom : ${senderName}\n` +
    `JID : ${ctx.senderJid?.split('@')[0]}\n` +
    `Messages memorises : ${msgCount}\n` +
    `Contexte actif : ${msgCount > 0 ? '✅ Oui' : '❌ Non'}\n\n` +
    `_Le Cognitive OS construit ton profil au fil du temps._`
  );
}
