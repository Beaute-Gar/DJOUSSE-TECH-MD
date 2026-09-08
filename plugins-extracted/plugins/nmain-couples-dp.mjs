import config from "../config.cjs";
import { fetchCoupleDP } from '../inconnu/tech.cjs';
import { cmd } from '../command.cjs';

const couplePP = async (m, gss) => {
  const prefix = config.PREFIX;
  const body = m.body.startsWith(prefix) ? m.body.slice(prefix.length) : "";
  const command = body.trim().split(" ")[0].toLowerCase();
  const validCmds = ["ppcauple", "couple", "cpp"];
  if (!validCmds.includes(command)) return;

  try {
    if (typeof m.React === "function") await m.React("â¤ï¸");

    const { male, female } = await fetchCoupleDP();
    const inconnuThumb = `https://files.catbox.moe/e1k73u.jpg`;

    const contextTemplate = {
      isForwarded: true,
      forwardingScore: 2025,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363397722863547@newsletter',
        newsletterName: "DJOUSSE-TECH-MD BOT",
        serverMessageId: 99
      },
      externalAdReply: {
        title: "COUPLE DP GENERATOR",
        body: "MADE BY DJOUSSE-TECH-MD",
        mediaType: 1,
        thumbnailUrl: inconnuThumb,
        sourceUrl: "https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R",
        renderLargerThumbnail: true
      }
    };

    await gss.sendMessage(m.from, {
      image: { url: male },
      caption: `â•­â”€â”€â”€â”€[ ðŸ§‘ *FOR MALE* ]\nâ”‚  _MADE IN BY DJOUSSE-TECH-MD_\nâ•°â”€â”€â”€â”€â”€â”€â—†`,
      contextInfo: contextTemplate,
    }, { quoted: m });

    await gss.sendMessage(m.from, {
      image: { url: female },
      caption: `â•­â”€â”€â”€â”€[ ðŸ‘© *FOR FEMALE* ]\nâ”‚  _MADE IN BY DJOUSSE-TECH-MD_\nâ•°â”€â”€â”€â”€â”€â”€â—†`,
      contextInfo: contextTemplate,
    }, { quoted: m });

    if (typeof m.React === "function") await m.React("âœ…");

  } catch (err) {
    console.error("Couple PP command error:", err);
    if (typeof m.React === "function") await m.React("âŒ");
    await m.reply("âŒ *Failed to fetch couple DP.*\nPlease try again later.");
  }
};

export default couplePP;

cmd({
  pattern: 'ppcauple',
  alias: ['couple', 'cpp'],
  desc: 'Générer deux images de profil couple',
  category: 'media',
  filename: new URL(import.meta.url).pathname,
}, async (conn, m) => couplePP(m, conn));

