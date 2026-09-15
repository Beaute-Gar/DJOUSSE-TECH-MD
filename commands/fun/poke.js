const { cmd } = require('../command.cjs');

cmd({
  pattern: 'poke',
  alias: ['pousser'],
  desc: 'Poke someone',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply('🤖 [SYSTEM] Mention someone to poke! Usage: .poke @user');

  const target = mentions[0];
  const messages = [
    `👉 [ROBOT] ${m.sender.split('@')[0]} a exécuté un poke numérique sur @${target.split('@')[0]}. Désagrément détecté : ${Math.floor(Math.random() * 100)}%.`,
    `🤖 [SYSTEM] Protocole de poussée activé. ${m.sender.split('@')[0]} a poussé @${target.split('@')[0]} virtuellement. Niveau d'agacement : ${Math.floor(Math.random() * 100)}%.`,
    `⚡ [ROBOT] Scan de irritation en cours. Cible : @${target.split('@')[0]}. Perturbation calculée : ${Math.floor(Math.random() * 100)}%.`,
    `👉 [SYSTEM] ${m.sender.split('@')[0]} a envoyé un poke hypersonique vers @${target.split('@')[0]}. Réaction attendue.`,
    `⚡ [ROBOT] Algorithme de poke exécuté. @${target.split('@')[0]} a été perturbé ${Math.floor(Math.random() * 10)} fois.`
  ];

  const text = messages[Math.floor(Math.random() * messages.length)];
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
