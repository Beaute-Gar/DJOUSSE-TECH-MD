const { cmd } = require('../command.cjs');

cmd({
  pattern: 'vs',
  alias: ['battle', 'combat'],
  desc: 'Battle between two users',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length < 2) return m.reply('🤖 [SYSTEM] Mention two users! Usage: .vs @user1 @user2');

  const user1 = mentions[0].split('@')[0];
  const user2 = mentions[1].split('@')[0];

  const stats1 = { power: Math.floor(Math.random() * 100), speed: Math.floor(Math.random() * 100), intelligence: Math.floor(Math.random() * 100) };
  const stats2 = { power: Math.floor(Math.random() * 100), speed: Math.floor(Math.random() * 100), intelligence: Math.floor(Math.random() * 100) };

  const total1 = stats1.power + stats1.speed + stats1.intelligence;
  const total2 = stats2.power + stats2.speed + stats2.intelligence;
  const winner = total1 > total2 ? user1 : total2 > total1 ? user2 : null;

  const text = `⚔️ [ROBOT] BATTLE INITIATED!\n\n🔵 ${user1}\n💪 Power: ${stats1.power} | ⚡ Speed: ${stats1.speed} | 🧠 Intelligence: ${stats1.intelligence}\n📊 Total: ${total1}\n\nVS\n\n🔴 ${user2}\n💪 Power: ${stats2.power} | ⡿ Speed: ${stats2.speed} | 🧠 Intelligence: ${stats2.intelligence}\n📊 Total: ${total2}\n\n🏆 ${winner ? `Gagnant: ${winner}` : '⚖️ MATCH NUL !'}\n\n⚡ [ROBOT] Combat simulé terminé.`;

  await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
});
