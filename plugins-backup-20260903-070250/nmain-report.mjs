import config from '../config.cjs';

const report = async (m, gss) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['report', 'bugreport'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}report <message>\n\nDescribe the bug or issue you found.`);
  }

  const sender = m.sender;
  const groupInfo = m.isGroup ? `\n📍 Group: ${m.from}` : '';

  const reportMsg = `🐛 *BUG REPORT*

👤 *From:* @${sender.split('@')[0]}
📅 *Date:* ${new Date().toLocaleString()}
${groupInfo}

📝 *Message:*
${text}`;

  await gss.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
    text: reportMsg,
    mentions: [sender]
  });

  m.reply('✅ Your report has been sent to the developer. Thank you!');
};

export default report;
