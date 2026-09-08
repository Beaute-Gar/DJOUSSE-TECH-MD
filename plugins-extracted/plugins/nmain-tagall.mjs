import config from '../config.cjs';

const tagEveryoneInGroup = async (message, sock) => {
  const prefix = config.PREFIX;
  const cmd = message.body.startsWith(prefix)
    ? message.body.slice(prefix.length).trim().split(' ')[0].toLowerCase()
    : '';

  if (cmd !== 'tagall') return;

  if (!message.isGroup) {
    return await sock.sendMessage(
      message.from,
      { text: 'ðŸš« Cette commande fonctionne uniquement dans les groupes.' },
      { quoted: message }
    );
  }

  try {
    const groupMeta = await sock.groupMetadata(message.from);
    const participants = groupMeta.participants;
    const senderId = message.sender;

    // Image de secours en cas d'erreur
    const fallbackImage = '../../media/djousse.jpg';

    // Essaie de rÃ©cupÃ©rer la photo de profil du crÃ©ateur du message
    let profilePicture = fallbackImage;
    try {
      profilePicture = await sock.profilePictureUrl(senderId, 'image');
    } catch (e) {
      profilePicture = fallbackImage; // Utilise l'image de secours si erreur
    }

    const mentions = participants.map(p => p.id);
    const adminCount = participants.filter(p => p.admin).length;
    const senderName = senderId.split('@')[0];
    const rawText = message.body.trim().split(' ').slice(1).join(' ');
    const userText = rawText || 'Blanc';
    const tagList = mentions.map(id => `@${id.split('@')[0]}`).join('\n');

    const caption = `
â•­â”€â”€â”€â”€â”€â”€â”€â—‡
â”‚ *DJOUSSE-TECH-MD TAGALL*
â•°â”€â”€â”€â”€â”€â”€â”€â—‡

ðŸ‘¥ *Groupe* : ${groupMeta.subject}
ðŸ‘¤ *Auteur* : @${senderName}
ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦ *Membres* : ${participants.length}
ðŸ›¡ï¸ *Admins* : ${adminCount}

ðŸ—’ï¸ *Message* :
${userText}

${tagList}

> MADE IN BY DJOUSSSE
`;

    await sock.sendMessage(
      message.from,
      {
        image: { url: profilePicture },
        caption,
        mentions
      },
      { quoted: message }
    );

  } catch (err) {
    console.error('Erreur dans tagall:', err);
    await sock.sendMessage(
      message.from,
      { text: 'âŒ Une erreur est survenue lors du tag.' },
      { quoted: message }
    );
  }
};

export default tagEveryoneInGroup;


