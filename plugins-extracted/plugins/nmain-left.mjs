import config from '../config.cjs';

const leaveGroup = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
  const isCreator = [botNumber, config.OWNER_NUMBER + '@s.whatsapp.net'].includes(m.sender);
    const prefix = config.PREFIX;
const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
const text = m.body.slice(prefix.length + cmd.length).trim();
    
    const validCommands = ['leave', 'exit', 'left'];

    if (!validCommands.includes(cmd)) return;
    
    if (!m.isGroup) return m.reply("*Î¹Ñ‚ Î¹Ñ• gÑÏƒÏ…Ï Â¢ÏƒÐ¼Ð¼Î±Î·âˆ‚ Ð²Î¹Ñ‚Â¢Ð½*");

    if (!isCreator) return m.reply("*ÏƒÎ·â„“Ñƒ DJOUSSE-TECH-MD Ñ‚Ð½ÑÑ”Ñ” ÊÑ•Ñ”Ñ Â¢Î±Î· Ï…Ñ•Ñ” Ñ‚Ð½Î¹Ñ• Â¢ÏƒÐ¼Ð¼Î±Î·âˆ‚*");

    await gss.groupLeave(m.from);
  } catch (error) {
    console.error('Error:', error);
  }
};

export default leaveGroup;

