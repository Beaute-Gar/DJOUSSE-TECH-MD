const { cmd } = require('../command.cjs');

cmd({
  pattern: 'kiss',
  alias: ['embrasser'],
  desc: 'Kiss someone virtually',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone to kiss! Usage: .kiss @user');

  const target = mentions[0];
  const messages = [
    `💋 [ROBOT] ${m.sender.split('@')[0]} a initié un protocole de baiser virtuel sur @${target.split('@')[0]}. Niveau de sucrerie : ${Math.floor(Math.random() * 100)}%.`,
    `🤖 [SYSTEM] Scan émotionnel terminé. ${m.sender.split('@')[0]} a envoyé un baiser numérique à @${target.split('@')[0]}. Température amoureuse : ${Math.floor(Math.random() * 100)}°.`,
    `⚡ [ROBOT] Protocole kiss.exe exécuté. Cible : @${target.split('@')[0]}. Taux de dopamine simulé : ${Math.floor(Math.random() * 100)}%.`,
    `💖 [SYSTEM] ${m.sender.split('@')[0]} a généré un baiser haute définition vers @${target.split('@')[0]}. Connexion émotionnelle établie.`,
    `💋 [ROBOT] Algorithme romantique activé. @${target.split('@')[0]} a reçu ${Math.floor(Math.random() * 10)} baisers加密.`
  ];

  const text = messages[Math.floor(Math.random() * messages.length)];
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
