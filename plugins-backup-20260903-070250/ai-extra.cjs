const { cmd } = require('../command.cjs');
const { freeChat, classifyError } = require('../lib/ai.cjs');
const { getBuffer } = require('../lib/functions.cjs');
const { sendSmartReply } = require('../lib/voice-responder.cjs');
const { getAIMemory } = require('../src/services/ai-memory.cjs');

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

async function imagen(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&model=flux`;
  const buf = await getBuffer(url);
  if (buf && buf.length) return buf;
  try {
    const pz = require('../lib/prexzy.cjs');
    return await pz.aiImage(prompt);
  } catch { return null; }
}

cmd({ pattern: 'askai', desc: 'Poser une question à l\'IA', category: 'ai', filename: __filename }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply('❌ Usage: .askai <question>');
  m.reply('🤖 *Réflexion en cours...*');
  try {
    const context = getHistoryContext(m.sender);
    const res = await freeChat(text, { context });
    if (!res) return m.reply('⏳ Service IA temporairement indisponible. Réessaie dans quelques minutes.');
    storeExchange(m.sender, text, res);
    await sendSmartReply(conn, m, `🤖 *AI Response:*\n\n${res}`);
  } catch (e) {
    const classified = classifyError(e);
    m.reply(classified.userMsg + '\n\n💡 Réessaie dans quelques instants.');
  }
});

cmd({ pattern: 'blackbox', desc: 'Pose une question à Blackbox AI', category: 'ai', filename: __filename }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply('❌ Usage: .blackbox <question>');
  m.reply('🧠 *Blackbox AI réfléchit...*');
  try {
    const context = getHistoryContext(m.sender);
    const res = await freeChat('Tu es Blackbox AI, assistant IA. Réponds de façon concise.\n\n' + text, { context });
    if (!res) return m.reply('⏳ Blackbox AI est temporairement indisponible. Réessaie.');
    storeExchange(m.sender, text, res);
    await sendSmartReply(conn, m, `🖤 *Blackbox AI:*\n\n${res}`);
  } catch (e) {
    const classified = classifyError(e);
    m.reply(classified.userMsg + '\n\n💡 Réessaie dans quelques instants.');
  }
});

cmd({ pattern: 'aiimg', desc: 'Générer une image par IA', category: 'ai', filename: __filename }, async (conn, m) => {
  const prompt = m.body.split(' ').slice(1).join(' ');
  if (!prompt) return m.reply('❌ Usage: .aiimg <description>');
  m.reply('🎨 *Génération de l\'image...*');
  const buf = await imagen(prompt);
  if (!buf) return m.reply('❌ Génération d\'image impossible actuellement. Réessaie plus tard.');
  await conn.sendMessage(m.chat, { image: buf, caption: `🎨 *${prompt}*\n\n> Généré par DJOUSSE TECH IA` }, { quoted: m });
});

cmd({ pattern: 'draw', desc: 'Générer une image par IA (alias imagine)', category: 'ai', filename: __filename }, async (conn, m) => {
  const prompt = m.body.split(' ').slice(1).join(' ');
  if (!prompt) return m.reply('❌ Usage: .draw <description>');
  m.reply('🎨 *Génération de l\'image...*');
  const buf = await imagen(prompt);
  if (!buf) return m.reply('❌ Génération d\'image impossible actuellement. Réessaie plus tard.');
  await conn.sendMessage(m.chat, { image: buf, caption: `🎨 *${prompt}*\n\n> Généré par DJOUSSE TECH IA` }, { quoted: m });
});

cmd({ pattern: 'aitranslate', desc: 'Traduction intelligente par IA', category: 'ai', filename: __filename }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const lang = args[0]?.toLowerCase() || 'fr';
  const text = args.slice(1).join(' ') || (m.quoted?.text || '');
  if (!text) return m.reply('❌ Usage: .aitranslate <langue> <texte>\nEx: .aitranslate en Bonjour');
  try {
    const res = await freeChat('Traduis ce texte en ' + lang + '. Réponds uniquement avec la traduction : "' + text + '"');
    if (!res) return m.reply('⏳ Service de traduction indisponible. Réessaie.');
    await sendSmartReply(conn, m, `🌐 *Traduction IA (${lang}):*\n\n${res}`);
  } catch (e) {
    const classified = classifyError(e);
    m.reply(classified.userMsg + '\n\n💡 Réessaie dans quelques instants.');
  }
});
