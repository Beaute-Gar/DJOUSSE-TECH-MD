const { cmd } = require('../command.cjs');

cmd({
  pattern: 'bestie',
  alias: ['bestie %'],
  desc: 'Calculate bestie percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone! Usage: .bestie @user');

  const target = mentions[0];
  const percentage = Math.floor(Math.random() * 101);
  const sender = m.sender.split('@')[0];
  const targetName = target.split('@')[0];

  let level, emoji;
  if (percentage >= 90) { level = 'MEILLEURS AMIS POUR LA VIE'; emoji = '💖'; }
  else if (percentage >= 70) { level = 'AMIS TRÈS PROCHES'; emoji = '💕'; }
  else if (percentage >= 50) { level = 'BONS AMIS'; emoji = '🤝'; }
  else if (percentage >= 30) { level = 'CONNAISSANCES'; emoji = '👋'; }
  else { level = 'PAS TRÈS PROCHES'; emoji = '😐'; }

  const text = `🤖 [SYSTEM] Analyse de connexion amicale en cours...\n\n📊 Résultat : ${sender} & ${targetName}\n${emoji} Pourcentage d'amitié : ${percentage}%\n📝 Niveau : ${level}\n\n⚡ [ROBOT] Données calculées avec précision robotique.`;

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
