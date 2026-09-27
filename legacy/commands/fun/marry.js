const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'marry',
  desc: 'Propose marriage to someone',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Mention someone! Usage: .marry @user' }]));

  const target = mentions[0];
  const sender = m.sender.split('@')[0];
  const targetName = target.split('@')[0];
  const accepted = Math.random() > 0.5;

  let text;
  if (accepted) {
    text = boxWithFooter('💍 MARIAGE ACCEPTÉ', [
      { raw: `${sender} a proposé à ${targetName}` },
      { raw: '✅ Réponse : ACCEPTÉ !' },
      { raw: '💓 Félicitations ! Union virtuelle enregistrée.' },
    ]);
  } else {
    text = boxWithFooter('💔 MARIAGE REFUSÉ', [
      { raw: `${sender} a proposé à ${targetName}` },
      { raw: '❌ Réponse : REFUSÉ.' },
      { raw: `😭 ${sender} a été friendzoné numériquement.` },
    ]);
  }

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
