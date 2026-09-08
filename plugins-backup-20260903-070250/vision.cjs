const { cmd } = require('../command.cjs');
const { describeImage } = require('../lib/ai.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');

cmd({ pattern: 'vision', alias: ['scan', 'see', 'describe'], desc: 'Analyser une image avec Qwen 3.6 Vision', category: 'ai', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  try {
    const quoted = m.quoted || m;
    const isImage = quoted?.msg?.imageMessage || quoted?.type === 'imageMessage';
    if (!isImage) return m.reply('❌ Réponds à une *image* avec .vision\n\nExemple: .vision Que contient cette image ?');
    await m.reply('👁️ Analyse de l\'image... (Qwen 3.6 Vision)');
    const t0 = Date.now();
    const buf = await downloadMediaMessage(quoted, 'scan_' + Date.now());
    if (!buf) return m.reply('❌ Impossible de télécharger l\'image.');
    const prompt = (q || 'Décris cette image en français, en détail. Si tu vois du texte, transcris-le.');
    const answer = await describeImage(buf.toString('base64'), prompt);
    m.reply('👁️ *Qwen 3.6 Vision*\n\n' + answer + '\n\n⏱️ ' + (Date.now() - t0) + 'ms');
  } catch (e) {
    m.reply('❌ Erreur vision: ' + e.message);
  }
});
