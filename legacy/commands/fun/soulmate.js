const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'soulmate',
  desc: 'Find your soulmate percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Mention someone! Usage: .soulmate @user' }]));

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

  const text = boxWithFooter('🔮 ÂMES JUMELLES', [
    { label: '🔮 Résultat', value: `${sender} & ${targetName}` },
    { label: emoji + ' Compatibilité', value: `${percentage}%` },
    { label: '📝 Statut', value: level },
  ]);

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
