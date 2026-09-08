const { cmd } = require('../command.cjs');
const { chat, chatSystem, groq, MODELS, classifyError } = require('../lib/ai.cjs');
const { sendSmartReply, shouldRespondWithVoice } = require('../lib/voice-responder.cjs');
const axios = require('axios');

async function chatPollinations(text) {
  const r = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(text), { timeout: 40000 });
  return String(r.data).trim();
}

function makeAiCommand(pattern, aliases, label, fn) {
  cmd({ pattern, alias: aliases, category: 'ai', filename: __filename }, async (conn, m, commands, { q, reply }) => {
    try {
      if (!q) return reply('❌ Usage: .' + pattern + ' <question>\n\nExemple: .' + pattern + ' Bonjour');
      const t0 = Date.now();
      const answer = await fn(q);
      const timeStr = '\n\n⏱️ ' + (Date.now() - t0) + 'ms';
      const fullText = '🤖 *' + label + ':*\n\n' + answer + timeStr;
      
      // Réponse intelligente (voix ou texte aléatoirement)
      await sendSmartReply(conn, m, fullText);
    } catch (e) {
      const classified = classifyError(e);
      const errMsg = classified.userMsg || '❌ Erreur IA: ' + e.message;
      reply(errMsg + '\n\n💡 Réessaie dans quelques instants.');
    }
  });
}

makeAiCommand('ai', ['chatgpt', 'gpt'], 'DJOUSSE AI — GPT-OSS 120B', async (t) => {
  try { return await chat(t); } catch (e) {
    if (e.userMessage) throw e;
    return await chatPollinations(t);
  }
});
makeAiCommand('qwen', ['qwen3', 'qwen3.6', 'vision-ai'], 'Qwen 3.6 — 27B', async (t) => {
  try {
    const messages = [
      { role: 'system', content: 'Tu es une IA multilingue utile. Réponds en français.' },
      { role: 'user', content: t }
    ];
    const r = await groq(messages, { model: MODELS.multilingual, temperature: 0.7 });
    if (r && r.length) return r;
    throw new Error('Qwen pas disponible');
  } catch (e) {
    if (e.userMessage) throw e;
    return await chatPollinations(t);
  }
});
makeAiCommand('reason', ['raisonner', 'think'], 'GPT-OSS 120B — Raisonnement', async (t) => {
  try {
    return await chatSystem('Tu es un expert en résolution de problèmes. Analyse étape par étape, puis conclus. Réponds en français.', t);
  } catch (e) {
    if (e.userMessage) throw e;
    return await chatPollinations(t);
  }
});
makeAiCommand('openai', ['gpt3', 'gpt4', 'open-gpt'], 'OpenAI', async (t) => {
  try { return await chatSystem('Réponds de manière concise.', t); } catch (e) {
    if (e.userMessage) throw e;
    return await chatPollinations(t);
  }
});
makeAiCommand('deepseek', ['ds'], 'DeepSeek', async (t) => {
  try { return await chatSystem('Tu es DeepSeek. Réponds en français.', t); } catch (e) {
    if (e.userMessage) throw e;
    return await chatPollinations(t);
  }
});
