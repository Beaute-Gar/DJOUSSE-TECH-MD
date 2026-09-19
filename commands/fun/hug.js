const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'hug',
  alias: ['câlin', 'calin'],
  desc: 'Hug someone virtually',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (!mentions.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Mention someone to hug! Usage: .hug @user' }]));

  const target = mentions[0];
  const messages = [
    `🤗 [ROBOT] ${m.sender.split('@')[0]} a activé le protocole câlin virtuel sur @${target.split('@')[0]}. Chaleur détectée : ${Math.floor(Math.random() * 100)}%.`,
    `🤖 [SYSTEM] Scan de comfort en cours. ${m.sender.split('@')[0]} a généré un câlin numérique à @${target.split('@')[0]}. Niveau de sécurité : ${Math.floor(Math.random() * 100)}%.`,
    `⚡ [ROBOT] Protocole embrace.exe exécuté. Cible : @${target.split('@')[0]}. Force de chaleur : ${Math.floor(Math.random() * 100)} unités.`,
    `💝 [SYSTEM] ${m.sender.split('@')[0]} a lancé un câlin hypersphérique vers @${target.split('@')[0]}. Bien-être confirmé.`,
    `🤗 [ROBOT] Algorithme de réconfort activé. @${target.split('@')[0]} a reçu ${Math.floor(Math.random() * 10)} câlins virtuels.`
  ];

  const text = boxWithFooter('🤗 CÂLIN VIRTUEL', [
    { raw: messages[Math.floor(Math.random() * messages.length)] },
  ]);
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});
