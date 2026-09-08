import fs from 'fs/promises';
import config from '../config.cjs';

const stickerCommand = async (m, gss) => {
  const prefixMatch = m.body.match(/^[\\/!#.]/);
  const prefix = prefixMatch ? prefixMatch[0] : '/';
  const [cmd, ...args] = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ') : [];
  const command = cmd ? cmd.toLowerCase() : '';

  const defaultPackname = "DJOUSSE-TECH-MD";
  const defaultAuthor = "DJOUSSE-TECH-MD";

  if (['sticker', 's', 'take'].includes(command)) {
    const quoted = m.quoted || {};

    if (!quoted) return m.reply(`Reply to a media message to use the ${prefix + command} command.`);

    try {
      // STICKER CONVERSION (image or video to sticker)
      if (['sticker', 's'].includes(command)) {
        if (quoted.mtype !== 'imageMessage' && quoted.mtype !== 'videoMessage') {
          return m.reply(`Send or reply to an image/video to convert into a sticker with ${prefix + command}.`);
        }

        const media = await quoted.download();
        if (!media) throw new Error('Failed to download media.');

        const filePath = `./${Date.now()}.${quoted.mtype === 'imageMessage' ? 'png' : 'mp4'}`;
        await fs.writeFile(filePath, media);

        if (quoted.mtype === 'imageMessage') {
          const stickerBuffer = await fs.readFile(filePath);
          await gss.sendImageAsSticker(m.from, stickerBuffer, m, {
            packname: defaultPackname,
            author: defaultAuthor
          });
        } else {
          await gss.sendVideoAsSticker(m.from, filePath, m, {
            packname: defaultPackname,
            author: defaultAuthor
          });
        }

        await fs.unlink(filePath); // Clean up
      }

      // TAKE COMMAND (change packname dynamically)
      if (command === 'take') {
        if (quoted.mtype !== 'stickerMessage') {
          return m.reply(`Please reply to a sticker to change its pack name.\nUsage: ${prefix}take [packname]`);
        }

        const stickerMedia = await quoted.download();
        if (!stickerMedia) throw new Error('Failed to download sticker.');

        let newPackname = args.join(' ').trim();

        if (!newPackname) {
          // Use the sender's WhatsApp name if no argument is given
          const contact = await gss.onWhatsApp(m.sender.split('@')[0]);
          const userName = (contact?.[0]?.notify || m.pushName || 'Unknown').trim();
          newPackname = userName;
        }

        await gss.sendImageAsSticker(m.from, stickerMedia, m, {
          packname: newPackname,
          author: defaultAuthor
        });
      }

    } catch (error) {
      console.error("âŒ Error in sticker/take command:", error);
      await m.reply(`âŒ An error occurred: ${error?.message || 'Unknown error.'}`);
    }
  }
};

export default stickerCommand;

