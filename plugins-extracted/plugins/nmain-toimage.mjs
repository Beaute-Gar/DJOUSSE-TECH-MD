import fs from 'fs/promises';
import path from 'path';
import config from '../config.cjs';

const toImageCommand = async (m, gss) => {
  const prefix = config.PREFIX;
  const [cmd] = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ') : ['', ''];

  const validCommands = ['toimage', 'takepic'];

  if (!validCommands.includes(cmd)) return;

  const quoted = m.quoted || {};

  if (!quoted || quoted.mtype !== 'stickerMessage') {
    return m.reply(`âŒ *Oops!* You must reply to a sticker with \`${prefix + cmd}\` to convert it into an image.\n\nðŸ¤– *BOT:* DJOUSSE-TECH-MD\nðŸ‘¨â€ðŸ’» *DEV:* DJOUSSSE`);
  }

  const media = await quoted.download();
  if (!media) throw new Error('âŒ Failed to download the sticker.');

  const fileName = `./${Date.now()}.webp`;
  await fs.writeFile(fileName, media);

  const pngFile = fileName.replace('.webp', '.png');

  const { exec } = await import('child_process');
  await new Promise((resolve, reject) => {
    exec(`ffmpeg -i ${fileName} ${pngFile}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  await gss.sendMessage(m.from, {
    image: { url: pngFile },
    caption: `âœ¨ *Sticker converted successfully!*\n\nYour image is here.\n\nðŸ¤– *BOT:* DJOUSSE-TECH-MD\nðŸ‘¨â€ðŸ’» *DEV:* DJOUSSSE`
  }, { quoted: m });

  console.log(`âœ… [DJOUSSE-TECH-MD] Sticker converted to image by ${m.sender}`);

  // Clean up temp files
  await fs.unlink(fileName);
  await fs.unlink(pngFile);
};

export default toImageCommand;

