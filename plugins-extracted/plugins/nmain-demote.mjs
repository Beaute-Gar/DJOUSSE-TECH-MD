import config from '../config.cjs';

const demote = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ['demote', 'unadmin', 'todown'];
    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("ðŸ”’ *Group Command Only!*");

    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;

    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin;
    if (!isBotAdmin) return m.reply("âŒ *I'm not an admin in this group!*");

    const sender = m.sender;
    const isOwner = sender === config.OWNER_NUMBER + '@s.whatsapp.net';
    const isSudo = config.SUDO?.includes(sender);
    const isGroupAdmin = participants.find(p => p.id === sender)?.admin;

    if (!isOwner && !isSudo && !isGroupAdmin) {
      return m.reply("ðŸš« *Only admins can use this command!*");
    }

    if (!m.mentionedJid) m.mentionedJid = [];
    if (m.quoted?.participant) m.mentionedJid.push(m.quoted.participant);

    const users = m.mentionedJid.length > 0
      ? m.mentionedJid
      : text.replace(/[^0-9]/g, '').length > 0
      ? [text.replace(/[^0-9]/g, '') + '@s.whatsapp.net']
      : [];

    if (users.length === 0) {
      return m.reply("âš ï¸ *Please mention a user to demote!*");
    }

    const validUsers = users.filter(Boolean);

    const usernames = await Promise.all(
      validUsers.map(async (user) => {
        try {
          const contact = await gss.getContact(user);
          return contact.notify || contact.pushname || user.split('@')[0];
        } catch {
          return user.split('@')[0];
        }
      })
    );

    await gss.groupParticipantsUpdate(m.from, validUsers, 'demote')
      .then(() => {
        const demotedNames = usernames.map(u => `@${u}`).join(', ');
        m.reply(`âœ… *Demotion Successful!*\nðŸ‘¤ Users: ${demotedNames}\nðŸ·ï¸ Group: *${groupMetadata.subject}*`);
      })
      .catch(() => m.reply("â— *Failed to demote user(s). Please try again.*"));
  } catch (error) {
    console.error('Error:', error);
    m.reply("ðŸ’¥ *An unexpected error occurred while processing your command.*");
  }
};

export default demote;

