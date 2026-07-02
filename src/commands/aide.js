export const name = 'aide';
export const aliases = ['ask', 'demande'];
export const category = 'IA';
export const desc = 'Pose une question a l\'IA Groq (Llama 3)';
export const usage = '.aide <question>';
export const cooldown = 3;

export async function handler(m, ctx) {
  const { body, args } = ctx;
  const question = args.join(' ').trim();
  if (!question) {
    return m.reply('🤖 *Groq IA*\n\nUsage: .aide <question>\n\nEx: .aide quelle est la capitale du Cameroun ?');
  }
  try {
    await m.react('🤔');
    const { brainChat } = await import('../cognitive/brain.js');
    const reply = await brainChat(ctx.senderJid, question);
    await m.react('✅');
    await m.reply(`🤖 *Groq IA*\n\n${reply}`);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Erreur: ${err.message}`);
  }
}
