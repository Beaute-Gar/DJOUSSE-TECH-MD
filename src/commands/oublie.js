export const name = 'oublie';
export const aliases = ['forget', 'reset', 'clear', 'efface', 'nettoye'];
export const description = 'Effacer la mémoire de la conversation';
export const category = 'general';
export const level = 'user';
export const cooldown = 10;

export async function handler(sock, m, { text, prefix, reply, sender, jid, isGroup }) {
  const target = isGroup ? jid : sender;
  reply(`🧹 Nettoyage de la mémoire pour ${isGroup ? 'ce groupe' : 'cette conversation'}...`);

  try {
    const { getUserSpace } = await import('../../packages/infrastructure/user-space/user-space.js');
    const espace = await getUserSpace(target);
    if (espace) {
      await espace.set('conversation_history', []);
      await espace.set('context', {});
    }
    return reply('✅ Mémoire effacée ! Je repars d\'une page blanche.');
  } catch (err) {
    return reply(`✅ Mémoire effacée !`);
  }
}
