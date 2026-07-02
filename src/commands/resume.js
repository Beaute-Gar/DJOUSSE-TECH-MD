export const name = 'resume';
export const aliases = ['summary', 'resumer'];
export const category = 'IA';
export const desc = 'Resume les recentes discussions du groupe';
export const usage = '.resume';
export const cooldown = 10;

export async function handler(m, ctx) {
  if (!ctx.isGroup) {
    return m.reply('⚠️ .resume fonctionne uniquement dans les groupes.');
  }
  try {
    await m.react('📋');
    const { getAllMemoryStats } = await import('../cognitive/brain.js');
    const stats = getAllMemoryStats();
    if (stats.totalMessages < 5) {
      return m.reply('📭 Pas assez de messages en memoire (minimum 5). Le Cognitive OS accumule le contexte au fil des messages.');
    }
    const { brainSummarize } = await import('../cognitive/brain.js');
    const reply = await brainSummarize(ctx.jid, []);
    await m.react('✅');
    await m.reply(`📋 *Resume — ${new Date().toLocaleDateString('fr-FR')}*\n\n${reply}`);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Erreur: ${err.message}`);
  }
}
