import config from '../config.cjs';

const versionCommand = async (m, sock) => {
  const prefix = config.PREFIX || '.';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  if (cmd !== 'version') return;

  const message = `
ðŸŒŸ *DJOUSSE-TECH-MD - Version Info*
â•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â­“
â”‚ ðŸ¤– *Bot Name:* DJOUSSE-TECH-MD
â”‚ ðŸ› ï¸ *Version:* 2.0.0
â”‚ ðŸ‘‘ *Developer:* DJOUSSSE TECH
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â­“

ðŸš€ Stay tuned for more updates!
  `.trim();

  await sock.sendMessage(m.from, {
    image: { url: '../../media/djousse.jpg' },
    caption: message,
    contextInfo: {
      forwardingScore: 5,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterName: 'DJOUSSE-TECH-MD',
        newsletterJid: '120363397722863547@newsletter',
      },
    },
  }, { quoted: m });
};

export default versionCommand;


