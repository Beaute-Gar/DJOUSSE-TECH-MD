export const name = 'oublie';
export const aliases = ['forget', 'reset-moi'];
export const category = 'info';
export const desc = 'Efface la memoire de cette conversation';
export const usage = '.oublie';
export const cooldown = 5;

export async function handler(m, ctx) {
  try {
    const { clearMemory } = await import('../cognitive/brain.js');
    clearMemory(ctx.senderJid);
    await m.reply('🧹 *Memoire effacee.*\nJe ne me souviens plus de notre historique.\nNous repartons de zero !');
  } catch (err) {
    await m.reply(`❌ Erreur: ${err.message}`);
  }
}
