const { cmd } = require('../command.cjs');

cmd({
  pattern: 'enemy',
  alias: ['ennemi'],
  desc: 'Calculate enemy percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone! Usage: .enemy @user');

  const target = mentions[0];
  const percentage = Math.floor(Math.random() * 101);
  const sender = m.sender.split('@')[0];
  const targetName = target.split('@')[0];

  let level, emoji;
  if (percentage >= 90) { level = 'ENNEMI JURÉ'; emoji = '😡'; }
  else if (percentage >= 70) { level = 'RIVALS SÉRIEUX'; emoji = '😠'; }
  else if (percentage >= 50) { level = 'TENSION ÉLEVÉE'; emoji = '🤨'; }
  else if (percentage >= 30) { level = 'LÉGÈRE RIVALITÉ'; emoji = '😒'; }
  else { level = 'PAS D\'ENNEMI'; emoji = '😊'; }

  const text = `🤖 [SYSTEM] Analyse de rivalité en cours...\n\n⚔️ Résultat : ${sender} & ${targetName}\n${emoji} Niveau d'ennemi : ${percentage}%\n📝 Statut : ${level}\n\n⚡ [ROBOT] Calcul de rivalité terminé.`;

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
