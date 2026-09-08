import config from '../config.cjs';

const jidCommand = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const command = m.body?.startsWith(prefix)
    ? m.body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase()
    : '';

  if (command === 'jid') {
    const isGroup = m.from.endsWith('@g.us');
    const jid = isGroup ? m.from : m.sender;
    const title = isGroup ? 'ðŸŒ Group JID' : 'ðŸ‘¤ User JID';

    const text = `
â”Œâ”€â­“ *${title}*
â”‚
â””â”€â”€
\`\`\`
${jid}
\`\`\`
    `.trim();

    return await Matrix.sendMessage(m.from, {
      text,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterName: 'DJOUSSE-TECH-MD',
          newsletterJid: '120363397722863547@newsletter'
        }
      }
    }, { quoted: m });
  }
};

export default jidCommand;

