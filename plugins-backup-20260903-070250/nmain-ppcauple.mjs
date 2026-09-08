import config from '../config.cjs';
import axios from 'axios';

const ppcauple = async (m, gss) => {
  const prefix = config.PREFIX;
  const body = m.body.startsWith(prefix) ? m.body.slice(prefix.length) : "";
  const command = body.trim().split(" ")[0].toLowerCase();
  const validCmds = ["ppcauple2", "couple2", "cpp2"];
  if (!validCmds.includes(command)) return;

  try {
    if (typeof m.React === "function") await m.React("❤️");

    const maleResponse = await axios.get('https://randomuser.me/api/?gender=male');
    const femaleResponse = await axios.get('https://randomuser.me/api/?gender=female');
    
    const male = maleResponse.data.results[0]?.picture?.large;
    const female = femaleResponse.data.results[0]?.picture?.large;

    await gss.sendMessage(m.from, {
      image: { url: male },
      caption: `🧑 *Male Profile*\n\n> Made by DJOUSSE-TECH-MD`
    }, { quoted: m });

    await gss.sendMessage(m.from, {
      image: { url: female },
      caption: `👩 *Female Profile*\n\n> Made by DJOUSSE-TECH-MD`
    }, { quoted: m });

    if (typeof m.React === "function") await m.React("✅");

  } catch (err) {
    console.error("PP Couple error:", err);
    if (typeof m.React === "function") await m.React("❌");
    await m.reply("❌ *Failed to fetch couple profiles.*");
  }
};

export default ppcauple;
