import config from '../config.cjs';

// âš™ï¸ Hidetag Command (Open to Everyone) âš™ï¸
const tagEveryoneSilently = async (message, sock) => {
  // ðŸ”‘ Get Command Prefix ðŸ”‘
  const trigger = config.PREFIX;

  // ðŸ” Detect User Command ðŸ”
  const userCommand = message.body.startsWith(trigger)
    ? message.body.slice(trigger.length).trim().split(' ')[0].toLowerCase()
    : '';

  // âœ… Handle 'hidetag' Logic âœ…
  if (userCommand === 'hidetag') {
    // ðŸ›¡ï¸ Check Group Context ðŸ›¡ï¸
    if (!message.isGroup) {
      return await sock.sendMessage(
        message.from,
        { text: 'ðŸš« This command only works in group chats.' },
        { quoted: message }
      );
    }

    try {
      // ðŸ“¡ Get Group Info ðŸ“¡
      const groupData = await sock.groupMetadata(message.from);
      const participants = groupData.participants;
      const mentions = participants.map(p => p.id);

      // âœ‰ï¸ Extract Message Text âœ‰ï¸
      const textContent = message.quoted?.text || message.body.slice(trigger.length + userCommand.length).trim();

      if (!textContent) {
        return await sock.sendMessage(
          message.from,
          { text: 'âŒ Please reply to a message or add text after the command.' },
          { quoted: message }
        );
      }

      const silentNote = `_ðŸ”Š DJOUSSE-TECH-MD_`;

      // ðŸš€ Send Silent Mention Message ðŸš€
      await sock.sendMessage(
        message.from,
        {
          text: `${textContent}\n\n${silentNote}`,
          mentions
        },
        { quoted: message }
      );
    } catch (err) {
      console.error('Hidetag Error:', err);
      await sock.sendMessage(
        message.from,
        { text: 'âš ï¸ An error occurred while sending the silent tag message.' },
        { quoted: message }
      );
    }
  }
};

export default tagEveryoneSilently;

