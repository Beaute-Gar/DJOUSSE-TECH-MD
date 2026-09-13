const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const { getAIMemory } = require('../src/services/ai-memory.cjs');
const { getFacts } = require('../lib/ainoria-memory.cjs');
const { buildSystemPrompt } = require('../lib/knowledge.cjs');

const GEMINI_MODEL = 'gemini-3.6-flash';

cmd({
  pattern: 'gemini',
  alias: ['askai'],
  desc: 'Ask Gemini AI anything',
  category: 'ai',
  filename: __filename,
}, async (conn, m, commands, { q, reply, sender }) => {
  if (!q) {
    return reply(box('🤖 *ASK GEMINI*', [
      { label: 'Usage', value: '.ask <question>' },
      { label: 'Exemple', value: '.ask Quelle est la capitale du Cameroun ?' },
      { blank: true },
      { raw: 'Gemini répond à tout !' },
    ]));
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

  try {
    // Construire le contexte conversationnel depuis AI Memory
    let historyParts = [];
    try {
      const aiMem = getAIMemory();
      const history = aiMem.getHistory(sender);
      if (history && history.length > 0) {
        historyParts = history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      }
    } catch {}

    // Injecter la mémoire persistante AINORIA dans le contexte
    let ainoriaContext = '';
    try {
      const facts = getFacts(sender);
      if (facts.length > 0) {
        ainoriaContext = '\n\n[AINORIA MEMORY - informations connues sur cet utilisateur]:\n' +
          facts.map(f => `- ${f.key}: ${f.value}`).join('\n');
      }
    } catch {}

    const systemPrompt = buildSystemPrompt() + ainoriaContext;
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Je comprends. Je suis DJOUSSE TECH, prêt à répondre.' }] },
      ...historyParts,
      { parts: [{ text: q }] }
    ];

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents },
      { timeout: 30000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return reply('❌ Gemini n\'a pas de réponse.');

    // Stocker la réponse dans AI Memory
    try {
      const aiMem = getAIMemory();
      aiMem.addMessage(sender, 'user', q);
      aiMem.addMessage(sender, 'assistant', text.trim());
    } catch {}

    reply('🤖 *Gemini AI*\n\n' + text.trim());
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    reply('❌ Erreur Gemini: ' + msg);
  }
});
