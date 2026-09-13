const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');
const { getAIMemory } = require('../src/services/ai-memory.cjs');
const { getFacts } = require('../lib/ainoria-memory.cjs');

cmd({
  pattern: 'gemini',
  alias: ['askai'],
  desc: 'Pose une question à AINORIA',
  category: 'ai',
  filename: __filename,
}, async (conn, m, commands, { q, reply, sender }) => {
  if (!q) return reply('Usage: .ask <question>');

  try {
    let context = [];
    try {
      const aiMem = getAIMemory();
      const history = aiMem.getHistory(sender);
      if (history && history.length > 0) {
        context = history.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content }));
      }
    } catch {}

    let facts = '';
    try {
      const f = getFacts(sender);
      if (f.length > 0) facts = '\nInfos connues: ' + f.map(ff => ff.key + '=' + ff.value).join(', ');
    } catch {}

    const reponse = await ainoria.chat(q, { system: facts || undefined, context: context.length ? context : undefined });
    if (!reponse) return reply('AINORIA est indisponible. Réessaie plus tard.');

    try {
      const aiMem = getAIMemory();
      aiMem.addMessage(sender, 'user', q);
      aiMem.addMessage(sender, 'assistant', reponse.trim());
    } catch {}

    reply(reponse);
  } catch (e) {
    reply('Erreur: ' + e.message);
  }
});
