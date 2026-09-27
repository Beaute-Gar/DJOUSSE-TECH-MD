const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'wanted',
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

  const text = boxWithFooter('🚨 AVIS DE RECHERCHE', [
    { label: '👤 Suspect', value: target },
    { label: '🔍 Crime', value: crime },
    { label: '💰 Récompense', value: `${reward.toLocaleString()} €` },
    { blank: true },
    { raw: '⚠️ Toute personne ayant des informations est priée de le signaler.' },
  ]);
  await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
});
