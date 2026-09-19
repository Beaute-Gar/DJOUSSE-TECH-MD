const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'enemy',
  alias: ['ennemi'],
  desc: 'Calculate enemy percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Mention someone! Usage: .enemy @user' }]));

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

  const text = boxWithFooter('⚔️ ANALYSE DE RIVALITÉ', [
    { label: '⚔️ Résultat', value: `${sender} & ${targetName}` },
    { label: emoji + ' Niveau d\'ennemi', value: `${percentage}%` },
    { label: '📝 Statut', value: level },
  ]);

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
