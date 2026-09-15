const { cmd } = require('../command.cjs');

cmd({
  pattern: 'marry',
  alias: ['épouser'],
  desc: 'Propose marriage to someone',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone! Usage: .marry @user');

  const target = mentions[0];
  const sender = m.sender.split('@')[0];
  const targetName = target.split('@')[0];
  const accepted = Math.random() > 0.5;

  let text;
  if (accepted) {
    text = `💍 [ROBOT] Demande de mariage analysée...\n\n${sender} a proposé à ${targetName}\n✅ Réponse : ACCEPTÉ !\n💓 Félicitations ! Union virtuelle enregistrée.\n\n⚡ [ROBOT] Protocole de mariage exécuté avec succès.`;
  } else {
    text = `💔 [ROBOT] Demande de mariage analysée...\n\n${sender} a proposé à ${targetName}\n❌ Réponse : REFUSÉ.\n😭 Algorithme de rejet activé. ${sender} a été friendzoné numériquement.\n\n⚡ [ROBOT] Protocole de rejet terminé.`;
  }

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
