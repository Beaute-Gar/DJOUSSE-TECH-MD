const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'bestie',
  alias: ['bestie %'],
  desc: 'Calculate bestie percentage',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Mention someone! Usage: .bestie @user' }]));

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

  const text = boxWithFooter('💕 ANALYSE D\'AMITIÉ', [
    { label: '📊 Résultat', value: `${sender} & ${targetName}` },
    { label: emoji + ' Pourcentage d\'amitié', value: `${percentage}%` },
    { label: '📝 Niveau', value: level },
  ]);

  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
