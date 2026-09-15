const { cmd } = require('../command.cjs');

cmd({
  pattern: 'babyname',
  alias: ['bébé'],
  desc: 'Generate a baby name from two names',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length < 2) return m.reply('🤖 [SYSTEM] Mention two people! Usage: .babyname @user1 @user2');

  const name1 = m.message.extendedTextMessage.contextInfo.mentionedNames?.[0] || mentions[0].split('@')[0];
  const name2 = m.message.extendedTextMessage.contextInfo.mentionedNames?.[1] || mentions[1].split('@')[0];

  const nameParts1 = name1.split('');
  const nameParts2 = name2.split('');
  const mid1 = Math.floor(nameParts1.length / 2);
  const mid2 = Math.floor(nameParts2.length / 2);

  const babyName1 = nameParts1.slice(0, mid1).join('') + nameParts2.slice(mid2).join('');
  const babyName2 = nameParts2.slice(0, mid2).join('') + nameParts1.slice(mid1).join('');

  const text = `🤖 [SYSTEM] Génération de nom de bébé en cours...\n\n👨 ${name1} & 👩 ${name2}\n\n👶 Nom(s) généré(s) :\n✨ ${babyName1}\n✨ ${babyName2}\n\n⚡ [ROBOT] Algorithme de fusion de noms terminé.`;

  await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
});
