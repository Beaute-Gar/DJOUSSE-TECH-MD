const { cmd } = require('../command.cjs');

cmd({
  pattern: 'wanted',
  alias: ['recherché'],
  desc: 'Wanted poster effect',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target = mentions.length ? mentions[0].split('@')[0] : m.sender.split('@')[0];

  const crimes = [
    'Avoir volé le WiFi du voisin.',
    'Avoir mangé le dernier gâteau sans demander.',
    'Avoir mis des flocons dans le salon.',
    'Avoir envoyé un meme ringard.',
    'Avoir dit "c\'est pas faux" en pleine réunion.',
    'Avoir regardé une série sans spoil.',
    'Avoir fait semblant de travailler.',
    'Avoir mis ses pieds sur la table.',
    'Avis de recherche pour comportement suspect.',
    'Coupable d\'avoir dit bonjour au téléphone.'
  ];

  const crime = crimes[Math.floor(Math.random() * crimes.length)];
  const reward = Math.floor(Math.random() * 1000000);

  const text = `🚨 [ROBOT] AVIS DE RECHERCHE!\n\n👤 Suspect: ${target}\n🔍 Crime: ${crime}\n💰 Récompense: ${reward.toLocaleString()} €\n\n⚠️ Toute personne ayant des informations est priée de le signaler.\n\n⚡ [ROBOT] Avis généré par le système de police robotique.`;
  await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
});
