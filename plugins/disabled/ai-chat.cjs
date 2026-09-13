const { cmd } = require('../command.cjs');
const { chat, chatSystem, groq, MODELS, classifyError } = require('../lib/ai.cjs');
const { sendSmartReply } = require('../lib/voice-responder.cjs');

function makeAiCommand(pattern, aliases, label, fn) {
  cmd({ pattern, alias: aliases, category: 'ai', filename: __filename }, async (conn, m, commands, { q, reply }) => {
    try {
      if (!q) return reply('Utilisation : .' + pattern + ' <question>');
      const t0 = Date.now();
      const answer = await fn(q);
      const timeStr = (Date.now() - t0) + 'ms';
      await sendSmartReply(conn, m, answer);
    } catch (e) {
      const classified = classifyError(e);
      const errMsg = classified.userMsg || 'Erreur IA : ' + e.message;
      reply(errMsg);
    }
  });
}

makeAiCommand('ai', ['chatgpt', 'gpt'], 'DJOUSSE AI', async (t) => {
  return await chat(t);
});

makeAiCommand('qwen', ['qwen3', 'qwen3.6', 'vision-ai'], 'Qwen 3.6', async (t) => {
  const messages = [
    { role: 'system', content: 'Tu es une IA multilingue utile. Réponds en français.' },
    { role: 'user', content: t }
  ];
  return await groq(messages, { model: MODELS.multilingual, temperature: 0.7 });
});

makeAiCommand('reason', ['raisonner', 'think'], 'Raisonnement', async (t) => {
  return await chatSystem('Tu es un expert en résolution de problèmes. Analyse étape par étape, puis conclus. Réponds en français.', t);
});

makeAiCommand('openai', ['gpt3', 'gpt4', 'open-gpt'], 'OpenAI', async (t) => {
  return await chatSystem('Réponds de manière concise.', t);
});

makeAiCommand('deepseek', ['ds'], 'DeepSeek', async (t) => {
  return await chatSystem('Tu es DeepSeek. Réponds en français.', t);
});
