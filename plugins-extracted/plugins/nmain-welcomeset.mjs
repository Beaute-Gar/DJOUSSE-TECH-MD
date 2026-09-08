import config from '../config.cjs';

const gcEvent = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (cmd === 'welcome') {
    if (!m.isGroup) return m.reply("ðŸš« *This command only works in group chats!*");

    let responseMessage;

    if (text === 'on') {
      config.WELCOME = true;
      responseMessage = `â•­â”€â”€ã€” *WELCOME ENABLED* ã€•â”€â”€â•®
â”‚  
â”‚  âœ¦ Welcome & Goodbye messages  
â”‚     have been successfully *activated*!
â”‚
â”‚  âœ¦ New members will receive a  
â”‚     custom welcome greeting. ðŸ‘‹
â”‚  
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
    } else if (text === 'off') {
      config.WELCOME = false;
      responseMessage = `â•­â”€â”€ã€” *WELCOME DISABLED* ã€•â”€â”€â•®
â”‚  
â”‚  âœ¦ Welcome & Goodbye messages  
â”‚     have been successfully *disabled*.
â”‚
â”‚  âœ¦ New joiners or leavers  
â”‚     won't be notified. ðŸ”•
â”‚  
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
    } else {
      responseMessage = `â•­â”€â”€ã€” *ðŸ“˜ WELCOME USAGE* ã€•â”€â”€â•®
â”‚  
â”‚  âœ¦ *Type:* \`${prefix}welcome on\`
â”‚     âž¥ Enable Welcome/Left messages
â”‚  
â”‚  âœ¦ *Type:* \`${prefix}welcome off\`
â”‚     âž¥ Disable Welcome/Left messages
â”‚  
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
    }

    try {
      await Matrix.sendMessage(m.from, { text: responseMessage }, { quoted: m });
    } catch (error) {
      console.error("Error:", error);
      await Matrix.sendMessage(m.from, { text: 'âŒ *An error occurred while processing your request.*' }, { quoted: m });
    }
  }
};

export default gcEvent;

