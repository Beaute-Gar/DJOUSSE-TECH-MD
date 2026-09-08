import config from '../config.cjs';
import fetch from 'node-fetch';

const repo = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase()
    : '';

  if (cmd === "repo") {
    await m.React('ðŸš€');
    const repoUrl = 'https://github.com/INCONNU-BOY/DJOUSSE-TECH-MD';
    const imageUrl = '../../media/djousse.jpg';

    try {
      const apiUrl = `https://api.github.com/repos/INCONNU-BOY/DJOUSSE-TECH-MD`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Get user name or fallback
      const contact = await sock.onWhatsApp(m.sender.split('@')[0]);
      const userName = (contact?.[0]?.notify || m.pushName || 'User').trim();

      if (data && data.forks_count !== undefined && data.stargazers_count !== undefined) {
        const menuText = `
ðŸŒŸ *HELLO DJOUSSE-TECH-MD USER (${userName})* ðŸ‘‹
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ðŸ’Ž *DJOUSSE-TECH-MD V2 OFFICIAL REPOSITORY* ðŸ’Ž

ðŸ”— *GitHub Link:* 
${repoUrl}

ðŸ“Š *Live Repository Stats:*
â­ Stars: *${data.stargazers_count}*
ðŸ´ Forks: *${data.forks_count}*

ðŸš€ *Why Choose DJOUSSE-TECH-MD V2?*
âœ… Multi-Session Support
âœ… Auto QR Mode
âœ… Stylish UI & Animated Commands
âœ… Easy Deploy & Maintain

ðŸŽ¥ *Watch Tutorial & Setup:*
https://www.youtube.com/@techbot-u9d

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
*â¤ï¸ BY DJOUSSSE*
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        `.trim();

        await sock.sendMessage(m.from, {
          image: { url: imageUrl },
          caption: menuText,
          contextInfo: {
            forwardingScore: 5,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterName: "DJOUSSE-TECH-MD",
              newsletterJid: "120363397722863547@newsletter",
            },
          },
        }, { quoted: m });

      } else {
        await sock.sendMessage(m.from, {
          text: 'âš ï¸ GitHub repository data unavailable. Please try again later.',
          quoted: m
        });
      }

    } catch (error) {
      console.error("Repo fetch error:", error);
      await sock.sendMessage(m.from, {
        text: 'ðŸš¨ Failed to load repository information.',
        quoted: m
      });
    } finally {
      await m.React('âœ…');
    }
  }
};

export default repo;


