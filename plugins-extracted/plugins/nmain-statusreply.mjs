import config from '../config.cjs';

const statusReplyCommand = async (m, Matrix) => {
  const botNumber = await Matrix.decodeJid(Matrix.user.id);
  const isCreator = [botNumber, config.OWNER_NUMBER + '@s.whatsapp.net'].includes(m.sender);
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase()
    : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (cmd !== 'statusreply') return;

  if (!isCreator) {
    return m.reply('ðŸš« *ACCESS DENIED: ONLY OWNER CAN EXECUTE THIS COMMAND!*');
  }

  try {
    let responseText;

    if (text) {
      config.STATUS_READ_MSG = text;
      responseText = `
â•­â”ã€” âœ… ð’ð“ð€ð“ð”ð’ ðŒð„ð’ð’ð€ð†ð„ ð”ððƒð€ð“ð„ðƒ ã€•â”â¬£
â”ƒ ðŸ§  *New Status Message:*
â”ƒ ðŸ’¬ ${text}
â”ƒ ðŸ‘¤ *Updated By:* @${m.sender.split('@')[0]}
â•°â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â¬£
      `.trim();
    } else {
      responseText = `
â•­â”ã€” â— ð”ð’ð€ð†ð„ ã€•â”â¬£
â”ƒ âœï¸ *Usage:* ${prefix}statusreply <message>
â”ƒ ðŸ“Œ *Example:* ${prefix}statusreply I am currently busy!
â•°â”â”â”â”â”â”â”â”â”â”â”â”â¬£
      `.trim();
    }

    await Matrix.sendMessage(m.from, {
      text: responseText,
      mentions: [m.sender],
      contextInfo: {
        forwardingScore: 777,
        isForwarded: true,
        externalAdReply: {
          title: "DJOUSSE-TECH-MD- STATUS SET",
          body: "Smart Status Handler",
          thumbnailUrl: "https://i.imgur.com/vfFQ5UZ.png",
          mediaType: 1,
          renderLargerThumbnail: true,
          sourceUrl: "https://popkid-xtech.web.app"
        }
      }
    }, { quoted: m });

  } catch (err) {
    console.error('âŒ Error:', err);
    await Matrix.sendMessage(m.from, { text: 'âš ï¸ *ERROR SETTING STATUS MESSAGE.*' }, { quoted: m });
  }
};

export default statusReplyCommand;

