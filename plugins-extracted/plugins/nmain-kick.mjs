import config from '../config.cjs';

const kick = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ['kick', 'remove'];

    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("*Ñ‚Ð½Î¹Ñ• Î¹Ñ• gÑÏƒÏ…Ï Â¢ÏƒÐ¼Ð¼Î±Î·âˆ‚*");
    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;
    const botAdmin = participants.find(p => p.id === botNumber)?.admin;
    const senderAdmin = participants.find(p => p.id === m.sender)?.admin;

    if (!botAdmin) return m.reply("*Ð²ÏƒÑ‚ Ð¼Ï…Ñ•Ñ‚ Ð²Ñ” Î±âˆ‚Ð¼Î¹Î·*");
    if (!senderAdmin) return m.reply("*Î±ÑÑ” ÑƒÏƒÏ…  Î±âˆ‚Ð¼Î¹Î· Ð²Î¹Ñ‚Â¢Ð½*");

    if (!m.mentionedJid) m.mentionedJid = [];

    if (m.quoted?.participant) m.mentionedJid.push(m.quoted.participant);

    const users = m.mentionedJid.length > 0
      ? m.mentionedJid
      : text.replace(/[^0-9]/g, '').length > 0
      ? [text.replace(/[^0-9]/g, '') + '@s.whatsapp.net']
      : [];

    if (users.length === 0) {
      return m.reply("*Ð¼Ñ”Î·Ñ‚Î¹ÏƒÎ· Î± Ï…Ñ•Ñ”Ñ Ñ‚Ïƒ Ð²Ñ” ÑÑ”Ð¼ÏƒÎ½Ñ”âˆ‚*");
    }

    const validUsers = users.filter(Boolean);

    await gss.groupParticipantsUpdate(m.from, validUsers, 'remove')
      .then(() => {
        const kickedNames = validUsers.map(user => `@${user.split("@")[0]}`);
        m.reply(`*Ï…Ñ•Ñ”Ñ ${kickedNames} ÑÑ”Ð¼ÏƒÎ½Ñ”âˆ‚ Æ’ÑÏƒÐ¼ ${groupMetadata.subject}*`);
      })
      .catch(() => m.reply('Failed to kick user(s) from the group.'));
  } catch (error) {
    console.error('Error:', error);
    m.reply('An error occurred while processing the command.');
  }
};

export default kick;

