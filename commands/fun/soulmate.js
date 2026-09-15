const { cmd } = require('../command.cjs');

cmd({
  pattern: 'soulmate',
  alias: ['ame'],
  desc: 'Find your soulmate percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone! Usage: .soulmate @user');

  const target = mentions[0];
  const percentage = Math.floor(Math.random() * 101);
  const sender = m.sender.split('@')[0];
  const targetName = target.split('@')[0];

  let level, emoji;
  if (percentage >= 90) { level = 'ÂMES SOEURS'; emoji = '💍'; }
  else if (percentage >= 70) { level = 'CONNECTION PROFONDE'; emoji = '💕'; }
  else if (percentage >= 50) { level = 'POTENTIEL RÉEL'; emoji = '💗'; }
  else if (percentage >= 30) { level = 'AMOUR POSSIBLE'; emoji = '❤️'; }
  else { level = 'PAS COMPATIBLES'; emoji = '💔'; }

  const text = `🤖 [SYSTEM] Scan d'âmes jumelles en cours...\n\n🔮 Résultat : ${sender} & ${targetName}\n${emoji} Compatibilité : ${percentage}%\n📝 Statut : ${level}\n\n⚡ [ROBOT] Analyse romantique terminée.`;

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
