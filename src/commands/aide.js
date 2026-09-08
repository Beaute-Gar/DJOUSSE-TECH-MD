export const name = 'aide';
export const aliases = ['ask', 'question', 'demande', 'd'];
export const description = 'Poser une question à l\'IA';
export const category = 'general';
export const level = 'user';
export const cooldown = 2;

export async function handler(sock, m, { text, prefix, reply, sender, jid, isGroup }) {
  const question = text.replace(/^\.(aide|ask|question|demande|d)\s*/i, '').trim();
  if (!question) return reply(`Usage: ${prefix}aide <ta question>\nEx: ${prefix}aide Quel est le capital du Cameroun ?`);

  reply(`🤔 Je réfléchis à ta question...`);

  try {
    const { brainChat } = await import('../../packages/ainoria-intelligence/core/brain.js');
    const answer = await brainChat(sender || jid, question);
    reply(answer || '🤷 Je n\'ai pas trouvé de réponse.');
  } catch (err) {
    try {
      const { agentAnswer } = await import('../../packages/ainoria-intelligence/core/agent.js');
      const ctx = { sock, jid, senderJid: sender || jid, isGroup, cleanText: question, m: { reply, react: () => {} } };
      await agentAnswer(ctx);
    } catch (e2) {
      reply(`❌ Erreur: ${e2.message}`);
    }
  }
}
