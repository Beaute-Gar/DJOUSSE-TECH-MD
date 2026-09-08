import axios from 'axios';

const cmd = ['pinterestdl', 'pinterest', 'pin', 'pins', 'pindownload'];

const commands = async (sock, m, args) => {
  const url = args[0];

  if (!url || !url.startsWith("http")) {
    return m.reply("âŽ Please provide a valid Pinterest URL.\n\nExample: *.pin https://www.pinterest.com/pin/123456789/*");
  }

  try {
    const apiUrl = `https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.success || !data.result.media || data.result.media.length === 0) {
      return m.reply("âŽ Failed to fetch media. Make sure the Pinterest link is correct.");
    }

    const { title, description, media } = data.result;
    const video = media.find(item => item.type.includes('720p'));
    const thumbnail = media.find(item => item.type === 'Thumbnail');
    const mediaType = video ? 'Video' : 'Image';

    const caption = `â•­â”â”â”ã€” *DJOUSSE-TECH-MD-PIN DL* ã€•â”â”â”â”ˆâŠ·
â”ƒâ–¸â•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â”ƒâ–¸â”ƒà¹ *Pinterest Downloader*
â”ƒâ–¸â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€Â·Â·Â·à¹
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”ˆâŠ·
â•­â”â”ââ”âª¼
â”‡à¹ *Title* : ${title || 'Unknown'}
â”‡à¹ *Description* : ${description || 'No description'}
â”‡à¹ *Media Type* : ${mediaType}
â•°â”â”â‘â”âª¼
> *Â© Powered by DJOUSSE-TECH-MD*`;

    if (video) {
      await sock.sendMessage(m.chat, { video: { url: video.download_url }, caption }, { quoted: m });
    } else if (thumbnail) {
      await sock.sendMessage(m.chat, { image: { url: thumbnail.download_url }, caption }, { quoted: m });
    } else {
      m.reply("âŽ No media found to download.");
    }

  } catch (err) {
    console.error("PinterestDL Error:", err);
    m.reply("âš ï¸ An error occurred while processing the Pinterest link.");
  }
};

export default async function loadPlugin(m, sock) {
  const prefix = /^[\\/!#.]/;
  const body = m.body || '';
  const isCOMMAND = prefix.test(body);
  const command = isCOMMAND ? body.slice(1).split(' ')[0].toLowerCase() : '';
  const args = body.trim().split(/\s+/).slice(1);

  if (cmd.includes(command)) {
    await commands(sock, m, args);
  }
  }

