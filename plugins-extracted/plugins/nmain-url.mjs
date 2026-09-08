import fetch from 'node-fetch';
import FormData from 'form-data';
const { fileTypeFromBuffer } = await import('file-type');

const MAX_FILE_SIZE_MB = 200;

async function uploadMedia(buffer) {
  try {
    const { ext, mime } = await fileTypeFromBuffer(buffer);
    const form = new FormData();
    form.append('upload', buffer, { filename: `file.${ext}`, contentType: mime });
    form.append('numfiles', '1');
    form.append('expiration', '0');
    form.append('type', 'file');

    const res = await fetch("https://postimages.org/json/rr", {
      method: "POST",
      body: form,
      headers: {
        "origin": "https://postimages.org",
        "referer": "https://postimages.org/",
      },
    });

    if (!res.ok) throw new Error(`Upload failed with status ${res.status}: ${res.statusText}`);

    const json = await res.json();
    if (!json || !json.url) throw new Error('Upload did not return a valid URL.');

    return json.url; // direct link like https://i.postimg.cc/xxx/filename.jpg
  } catch (error) {
    console.error("Error during media upload:", error);
    throw new Error('Failed to upload media');
  }
}

const tourl = async (m, bot) => {
  const prefixMatch = m.body.match(/^[\\/!#.]/);
  const prefix = prefixMatch ? prefixMatch[0] : '/';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const validCommands = ['url', 'geturl', 'upload', 'u'];

  if (validCommands.includes(cmd)) {
    if (!m.quoted || !['imageMessage', 'videoMessage', 'audioMessage'].includes(m.quoted.mtype)) {
      return m.reply(`Send/Reply/Quote an image, video, or audio to upload \n*${prefix + cmd}*`);
    }

    try {
      const loadingMessages = [
        "*ã€Œâ–°â–°â–°â–±â–±â–±â–±â–±â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–±â–±â–±â–±â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–±â–±â–±â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–°â–±â–±â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–°â–°â–±â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–°â–°â–°â–±â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–°â–°â–°â–°â–±ã€*",
        "*ã€Œâ–°â–°â–°â–°â–°â–°â–°â–°â–°â–°ã€*",
      ];

      const loadingMessageCount = loadingMessages.length;
      let currentMessageIndex = 0;

      const { key } = await bot.sendMessage(m.from, { text: loadingMessages[currentMessageIndex] }, { quoted: m });

      const loadingInterval = setInterval(() => {
        currentMessageIndex = (currentMessageIndex + 1) % loadingMessageCount;
        bot.sendMessage(m.from, { text: loadingMessages[currentMessageIndex] }, { quoted: m, messageId: key });
      }, 500);

      const media = await m.quoted.download();
      if (!media) {
        clearInterval(loadingInterval);
        return m.reply('âŒ Failed to download media.');
      }

      const fileSizeMB = media.length / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        clearInterval(loadingInterval);
        return m.reply(`âŒ File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB.`);
      }

      const mediaUrl = await uploadMedia(media);

      clearInterval(loadingInterval);
      await bot.sendMessage(m.from, { text: 'âœ… Upload complete.' }, { quoted: m });

      const mediaType = getMediaType(m.quoted.mtype);
      if (mediaType === 'audio') {
        const message = {
          text: `ðŸŽµ *Here is your audio URL:*\n${mediaUrl}`,
        };
        await bot.sendMessage(m.from, message, { quoted: m });
      } else {
        const message = {
          [mediaType]: { url: mediaUrl },
          caption: `ðŸŒ *URL:* ${mediaUrl}\n\nðŸ”§ Powered by DJOUSSE-TECH-MD`,
        };
        await bot.sendMessage(m.from, message, { quoted: m });
      }
    } catch (error) {
      console.error('Error processing media:', error);
      m.reply('âŒ Error processing media.');
    }
  }
};

const getMediaType = (mtype) => {
  switch (mtype) {
    case 'imageMessage':
      return 'image';
    case 'videoMessage':
      return 'video';
    case 'audioMessage':
      return 'audio';
    default:
      return null;
  }
};

export default tourl;

