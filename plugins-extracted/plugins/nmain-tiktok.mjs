import config from '../config.cjs';
import axios from 'axios';

const tiktokdl = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const q = m.body.split(' ').slice(1).join(' ');
  const reply = (text) => sock.sendMessage(m.from, { text }, { quoted: m });

  if (cmd === "tiktokdl" || cmd === "tiktok") {
    if (!q) return reply(`âœ¨ DJOUSSE-TECH-MD sá´€Ês Êá´á´œ sÊœá´á´œÊŸá´… á´˜Ê€á´á´ Éªá´…á´‡ á´€ á´›Éªá´‹á´›á´á´‹ ÊŸÉªÉ´á´‹. Example: ${prefix}${cmd} https://vm.tiktok.com/xxxx/ âœ¨`);
    if (!q.includes("tiktok.com")) return reply("âš ï¸ That doesn't look like a valid TikTok link.");

    await reply("ðŸš€ Initiating download... Please be patient! â³");

    try {
      const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${q}`;
      const { data } = await axios.get(apiUrl);

      if (!data.status || !data.data) return reply("ðŸ’” Failed to fetch TikTok video. The server might be down or the link is invalid.");

      const { title, like, comment, share, author, meta } = data.data;
      const videoUrl = meta.media.find(v => v.type === "video")?.org;
      const views = meta?.play_count || 'N/A'; // Attempt to get view count

      if (!videoUrl) return reply("âš ï¸ Could not retrieve the video URL from the response.");

      const caption = `ðŸŽ¬ *TikTok Video Downloaded!* ðŸŽ¬\n\n` +
                      `ðŸ‘¤ **Creator:** ${author.nickname} (@${author.username})\n` +
                      `ðŸ“ **Title:** ${title || 'No title available'}\n` +
                      `ðŸ‘ï¸ **Views:** ${views}\n` +
                      `â¤ï¸ **Likes:** ${like}\n` +
                      `ðŸ’¬ **Comments:** ${comment}\n` +
                      `ðŸ”— **Share:** ${share}\n\n` +
                      `á´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE! ðŸ˜‰`;

      await sock.sendMessage(m.from, {
        video: { url: videoUrl },
        caption: caption,
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m });

    } catch (e) {
      console.error("ðŸ”¥ Error during TikTok download:", e);
      reply(`ðŸš¨ An error occurred: ${e.message} ðŸš¨`);
    }
  }
};

export default tiktokdl;
                             

