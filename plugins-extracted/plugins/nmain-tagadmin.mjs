import config from '../config.cjs';

const tagAdminsInGroup = async (message, sock) => {
  const prefix = config.PREFIX;
  const cmd = message.body.startsWith(prefix)
    ? message.body.slice(prefix.length).trim().split(' ')[0].toLowerCase()
    : '';

  if (cmd !== 'tagadmin') return;

  if (!message.isGroup) {
    return await sock.sendMessage(
      message.from,
      { text: 'ðŸš« This command only works in group chats.' },
      { quoted: message }
    );
  }

  try {
    const groupMeta = await sock.groupMetadata(message.from);
    const participants = groupMeta.participants;
    const senderId = message.sender;

    const fallbackImage = '../../media/djousse.jpg';
    let profilePicture = fallbackImage;
    try {
      profilePicture = await sock.profilePictureUrl(senderId, 'image');
    } catch {
      profilePicture = fallbackImage;
    }

    const admins = participants.filter(p => p.admin);
    const mentions = admins.map(p => p.id);
    const senderName = senderId.split('@')[0];
    const rawText = message.body.trim().split(' ').slice(1).join(' ');
    const userText = rawText || 'No message.';

    const tagList = mentions.map(id => `â€¢ @${id.split('@')[0]}`).join('\n');

    const caption = `
ðŸ‘‘ *TAG ADMIN MODE*

ðŸ“› *Group:* ${groupMeta.subject}
ðŸ“¤ *By:* @${senderName}
ðŸ“Š *Admins:* ${admins.length}

ðŸ“ *Message:* ${userText}

${tagList}

_â€” DJOUSSE-TECH-MD SYSTEM_
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
    console.error('Error in tagadmin:', err);
    await sock.sendMessage(
      message.from,
      { text: 'âŒ An error occurred while tagging admins.' },
      { quoted: message }
    );
  }
};

export default tagAdminsInGroup;


