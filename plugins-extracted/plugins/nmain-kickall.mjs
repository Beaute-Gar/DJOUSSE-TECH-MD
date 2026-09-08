import config from '../config.cjs';

const kickAll = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

    if (cmd !== 'kickall') return; // Only proceed if the command is 'kickall'
    if (!m.isGroup) return m.reply("ðŸ”’ *Group Command Only!*");

    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;
    const botAdmin = participants.find(p => p.id === botNumber)?.admin;
    const senderAdmin = participants.find(p => p.id === m.sender)?.admin;

    if (!botAdmin) return m.reply("âŒ *I need to be admin to perform this action!*");
    if (!senderAdmin) return m.reply("ðŸš« *Only group admins can use this command!*");

    // Collect all non-admin members to remove
    const users = participants
      .filter(p => !p.admin) // Exclude admins
      .map(p => p.id);

    if (users.length === 0) {
      return m.reply("âš ï¸ *No non-admin members to kick!*");
    }

    await gss.groupParticipantsUpdate(m.from, users, 'remove')
      .then(() => {
        const kickedNames = users.map(user => `@${user.split('@')[0]}`).join(', ');
        m.reply(`âœ… *Kick Successful!*\nðŸ‘¤ Users kicked: ${kickedNames}\nðŸ·ï¸ Group: *${groupMetadata.subject}*`);

        // Styled follow-up message
        gss.sendMessage(m.from, {
          text: `âš ï¸ *DJOUSSE-TECH-MD has unleashed the purge!*\nðŸ’£ Kicked: ${kickedNames}\nðŸ«¡ *Order restored.*`,
          mentions: users
        });
      })
      .catch(() => m.reply("â— *Failed to kick user(s). Please try again.*"));
  } catch (error) {
    console.error('Error:', error);
    m.reply("ðŸ’¥ *An unexpected error occurred while processing your command.*");
  }
};

export default kickAll;

