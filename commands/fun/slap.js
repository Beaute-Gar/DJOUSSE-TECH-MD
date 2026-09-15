const { cmd } = require('../command.cjs');

cmd({
  pattern: 'slap',
  alias: ['gifle'],
  desc: 'Slap someone virtually',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone to slap! Usage: .slap @user');

  const target = mentions[0];
  const messages = [
    `💥 [ROBOT] ${m.sender.split('@')[0]} a généré une gifle virtuelle sur @${target.split('@')[0]}. Simulation de douleur : ${Math.floor(Math.random() * 100)}%.`,
    `⚡ [SYSTEM] Scan biométrique terminé. ${m.sender.split('@')[0]} a appliqué une gifle haute précision sur @${target.split('@')[0]}. Niveau de choc : ${Math.floor(Math.random() * 100)}%.`,
    `🤖 [ROBOT] Protocole de gifle activé. Cible : @${target.split('@')[0]}. Force calculée : ${Math.floor(Math.random() * 100)} unités.`,
    `💨 [SYSTEM] ${m.sender.split('@')[0]} a lancé une glique hypersonique vers @${target.split('@')[0]}. Impact confirmé.`,
    `⚡ [ROBOT] Algorithme de gifle exécuté. @${target.split('@')[0]} a reçu ${Math.floor(Math.random() * 10)} gifies numériques.`
  ];

  const text = messages[Math.floor(Math.random() * messages.length)];
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
