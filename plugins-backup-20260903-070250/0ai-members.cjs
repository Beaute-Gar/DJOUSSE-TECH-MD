const { cmd } = require('../command.cjs');
const { chat, freeChat, classifyError, DJOUSSE_PERSONA } = require('../lib/ai.cjs');
const { fetchJson } = require('../lib/functions.cjs');
const { sendSmartReply } = require('../lib/voice-responder.cjs');
const { getAIMemory } = require('../src/services/ai-memory.cjs');

/* ─── Remplacements GROQ (français, gratuits, sans désobfuscation) ─────────────
   Reprend le nom des commandes IA mortes (.ask/.gemini/.nova/.summarize)
   avec le moteur GROQ fonctionnel. Chargé en premier (prefixe 0) pour gagner
   face aux plugins obfusqués obsolètes. */

function getHistoryContext(sender) {
  try {
    const aiMem = getAIMemory();
    return aiMem.buildContext(sender);
  } catch { return []; }
}

function storeExchange(sender, userMsg, assistantMsg) {
  try {
    const aiMem = getAIMemory();
    aiMem.addMessage(sender, 'user', userMsg);
    aiMem.addMessage(sender, 'assistant', assistantMsg);
  } catch {}
}

/* Réponse ciblée : identifie le membre demandeur (@nom) pour qu'on ne
   mélange jamais les conversations en groupe. */
async function targetedReply(conn, m, text) {
  const name = m.pushName || m.sender?.split('@')[0] || 'ami';
  const cleanName = name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '');
  return sendSmartReply(conn, m, `@${cleanName} ${text}`, { mentions: m.sender ? [m.sender] : [] });
}

function handleError(m, e) {
  const classified = classifyError(e);
  m.reply(classified.userMsg + '\n\n💡 Réessaie dans quelques instants.');
}

cmd({ pattern: 'ask', alias: ['poser', 'demande'], desc: 'Poser une question à l\'IA (GROQ)', category: 'ai', filename: __filename }, async (conn, m, commands, ctx) => {
  const q = ctx.q || m.quoted?.msg?.text || '';
  if (!q) return m.reply('❌ Usage: .ask <question>\n\nExemple: .ask Qui es-tu ?');
  m.reply('⏳ Je réfléchis...');
  try {
    const context = getHistoryContext(m.sender);
    const res = await chat(q, { context });
    storeExchange(m.sender, q, res);
    await targetedReply(conn, m, '🤖 *Réponse :*\n\n' + res);
  } catch (e) { handleError(m, e); }
});

cmd({ pattern: 'gemini', alias: ['geminiai'], desc: 'Assistant IA Gemini (GROQ)', category: 'ai', filename: __filename }, async (conn, m, commands, ctx) => {
  const q = ctx.q || m.quoted?.msg?.text || '';
  if (!q) return m.reply('❌ Usage: .gemini <question>');
  m.reply('⏳ Réflexion en cours...');
  try {
    const context = getHistoryContext(m.sender);
    const res = await chat('Tu incarnes l\'assistant Gemini de Google. ' + q, { context });
    storeExchange(m.sender, q, res);
    await targetedReply(conn, m, '✨ *Gemini :*\n\n' + res);
  } catch (e) { handleError(m, e); }
});

cmd({ pattern: 'nova', alias: ['novason', 'assistant-nova'], desc: 'Assistant IA Nova (GROQ)', category: 'ai', filename: __filename }, async (conn, m, commands, ctx) => {
  const q = ctx.q || m.quoted?.msg?.text || '';
  if (!q) return m.reply('❌ Usage: .nova <question>');
  m.reply('⏳ Nova réfléchit...');
  try {
    const context = getHistoryContext(m.sender);
    const res = await chat('Tu es Nova, une IA rapide et brillante. ' + q, { context });
    storeExchange(m.sender, q, res);
    await targetedReply(conn, m, '🚀 *Nova :*\n\n' + res);
  } catch (e) { handleError(m, e); }
});

cmd({ pattern: 'summarize', alias: ['resume', 'sum'], desc: 'Résumer un texte ou un lien (GROQ)', category: 'ai', filename: __filename }, async (conn, m, commands, ctx) => {
  let q = ctx.q || m.quoted?.msg?.text || '';
  if (!q) return m.reply('❌ Usage: .summarize <texte ou lien>\nOu répondez à un message avec .summarize');
  m.reply('⏳ Je résume...');
  try {
    if (/^https?:\/\//i.test(q)) {
      const r = await fetchJson(q).catch(() => null);
      if (r && typeof r === 'string') q = r.slice(0, 6000);
      else if (r && typeof r === 'object') q = JSON.stringify(r).slice(0, 6000);
    }
    const res = await chat('Résume le texte suivant en français, points clés uniquement :\n\n' + String(q).slice(0, 6000));
    await targetedReply(conn, m, '📌 *Résumé :*\n\n' + res);
  } catch (e) { handleError(m, e); }
});

module.exports = { DJOUSSE_PERSONA };