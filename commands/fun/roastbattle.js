const { cmd } = require('../command.cjs');

cmd({
  pattern: 'roastbattle',
  alias: ['roast'],
  desc: 'Roast battle between two users',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length < 2) return m.reply('🤖 [SYSTEM] Mention two users! Usage: .roastbattle @user1 @user2');

  const user1 = mentions[0].split('@')[0];
  const user2 = mentions[1].split('@')[0];

  const roasts = [
    `${user1}, tu es si laid que quand tu prends des selfies, l'appareil fait la morose.`,
    `${user2}, tu es si lent que même un escargot te dépasse.`,
    `${user1}, ton code informatique est tellement mauvais qu'il a besoin d'un thérapeute.`,
    `${user2}, tu es si pauvre que même les mouches te donnent des pièces.`,
    `${user1}, tu es tellement bête que même Siri te corrige.`,
    `${user2}, tu es si vieux que tu as assisté au Big Bang en streaming.`,
    `${user1}, ton style est tellement nul que même un mannequin pleure.`,
    `${user2}, tu es si lent que tu reçois les SMS d'hier.`,
    `${user1}, tu es si laid que même un miroir se brise en te voyant.`,
    `${user2}, tu es si bête que tu confonds WiFi avec Wife.`
  ];

  const numRoasts = Math.floor(Math.random() * 3) + 2;
  const selectedRoasts = [];
  for (let i = 0; i < numRoasts; i++) {
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    if (!selectedRoasts.includes(roast)) selectedRoasts.push(roast);
  }

  const score1 = Math.floor(Math.random() * 10);
  const score2 = Math.floor(Math.random() * 10);
  const winner = score1 > score2 ? user1 : score2 > score1 ? user2 : null;

  let text = `🔥 [ROBOT] ROAST BATTLE!\n\n`;
  selectedRoasts.forEach((r, i) => { text += `${i + 1}. ${r}\n\n`; });
  text += `📊 Score:\n${user1}: ${score1}/10 💢\n${user2}: ${score2}/10 💢\n\n🏆 ${winner ? `Gagnant: ${winner}!` : '⚖️ MATCH NUL!'}\n\n⚡ [ROBOT] Combat de vannes terminé.`;

  await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
});
