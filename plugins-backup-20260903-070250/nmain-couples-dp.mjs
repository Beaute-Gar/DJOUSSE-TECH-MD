import config from '../config.cjs';
import axios from 'axios';

const couplePP = async (m, gss) => {
  const prefix = config.PREFIX;
  const body = m.body.startsWith(prefix) ? m.body.slice(prefix.length) : "";
  const command = body.trim().split(" ")[0].toLowerCase();
  const validCmds = ["ppcauple", "couple", "cpp"];
  if (!validCmds.includes(command)) return;

  try {
    if (typeof m.React === "function") await m.React("❤️");

    const response = await axios.get('https://randomuser.me/api/?gender=both');
    const users = response.data.results;
    const male = users[0]?.picture?.large;
    const female = users[1]?.picture?.large;

    const contextTemplate = {
      isForwarded: true,
      forwardingScore: 2025,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363397722863547@newsletter',
        newsletterName: "DJOUSSE-TECH-MD",
        serverMessageId: 99
      },
      externalAdReply: {
        title: "COUPLE DP GENERATOR",
        body: "MADE BY DJOUSSE TECH",
        mediaType: 1,
        sourceUrl: "https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R",
        renderLargerThumbnail: true
      }
    };

    await gss.sendMessage(m.from, {
      image: { url: male },
      caption: `╭────[ 🧑 *FOR MALE* ]\n│  _MADE BY DJOUSSE-TECH-MD_\n╰──────◆`,
      contextInfo: contextTemplate,
    }, { quoted: m });

    await gss.sendMessage(m.from, {
      image: { url: female },
      caption: `╭────[ 👩 *FOR FEMALE* ]\n│  _MADE BY DJOUSSE-TECH-MD_\n╰──────◆`,
      contextInfo: contextTemplate,
    }, { quoted: m });

    if (typeof m.React === "function") await m.React("✅");

  } catch (err) {
    console.error("Couple PP command error:", err);
    if (typeof m.React === "function") await m.React("❌");
    await m.reply("❌ *Failed to fetch couple DP.*\nPlease try again later.");
  }
};

export default couplePP;
