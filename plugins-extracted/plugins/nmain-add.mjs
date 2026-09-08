import config from '../config.cjs';

const add = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ['add', 'invite', 'bring'];
    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("*gÑÏƒÏ…Ï Â¢ÏƒÐ¼Ð¼Î±Î·âˆ‚*");

    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;

    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin;
    if (!isBotAdmin) return m.reply("*Î±Ð¼ Î·ÏƒÑ‚ Î±âˆ‚Ð¼Î¹Î· Î¹Î· Ñ‚Ð½Î¹Ñ• Î¹âˆ‚Î¹ÏƒÑ‚ gÑÏƒÏ…Ï*");

    const sender = m.sender;
    const isOwner = sender === config.OWNER_NUMBER + '@s.whatsapp.net';
    const isSudo = config.SUDO?.includes(sender);
    const isGroupAdmin = participants.find(p => p.id === sender)?.admin;

    if (!isOwner && !isSudo && !isGroupAdmin) {
      return m.reply("*Î±âˆ‚Ð¼Î¹Î· ÑÏ…â„“Ñ” Î¹âˆ‚Î¹ÏƒÑ‚*");
    }

    const number = text.replace(/[^0-9]/g, '');
    if (!number) return m.reply("*ÏÑÏƒÎ½Î¹âˆ‚Ñ” Î± Î½Î±â„“Î¹âˆ‚ Ð¸Ï…Ð¼Ð²Ñ”Ñ Ñ‚Ïƒ Î±âˆ‚âˆ‚*");

    const userId = number + '@s.whatsapp.net';

    await gss.groupParticipantsUpdate(m.from, [userId], 'add')
      .then(() => {
        m.reply(`*User @${number} added successfully to the group ${groupMetadata.subject}.*`);
      })
      .catch((e) => {
        console.error('Add Error:', e);
        m.reply("*Â¢ÏƒÏ…â„“âˆ‚ Ð¸ÏƒÑ‚ Î±âˆ‚âˆ‚ Ñ‚Ð½Ñ” Ï…Ñ•Ñ”Ñ. Ð¼Î±ÑƒÐ²Ñ” Ð½Ñ”/Ñ•Ð½Ñ” Ð½Î±Ñ• ÏÑÎ¹Î½Î±Â¢Ñƒ ÏƒÐ¸ ÏƒÑ â„“Ñ”Æ’Ñ‚ Ñ‚ÏƒÏƒ Ð¼Î±Ð¸Ñƒ Ñ‚Î¹Ð¼Ñ”Ñ•.*");
      });
  } catch (error) {
    console.error('Error:', error);
    m.reply('An error occurred while processing the command.');
  }
};

export default add;

