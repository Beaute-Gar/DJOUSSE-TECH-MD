import { sleep } from '../lib/utils.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, '../../data/tmp');

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

export const name = 'sticker';
export const aliases = ['s', 'autosticker', 'stiker', 'autocollant'];
export const description = 'Crée un sticker depuis une image ou une vidéo';
export const category = 'media';
export const level = 'user';

export async function handler(sock, m) {
  let mediaBuffer = null;
  let mediaType = null;

  if (m.quotedMsg?.quotedMessage) {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    mediaBuffer = await downloadMediaMessage({ message: m.quotedMsg.quotedMessage, key: m.key }, 'buffer', {}).catch(() => null);
    mediaType = Object.keys(m.quotedMsg.quotedMessage)[0];
  } else if (m.isMedia && m.download) {
    mediaBuffer = await m.download().catch(() => null);
    mediaType = m.msgType;
  }

  if (!mediaBuffer) {
    return m.reply('❌ *Répondez à une image ou vidéo* avec .sticker');
  }

  await m.react('🎨');

  try {
    const inputPath = join(TMP_DIR, `input_${Date.now()}.${mediaType === 'videoMessage' ? 'mp4' : 'png'}`);
    const outputPath = join(TMP_DIR, `sticker_${Date.now()}.webp`);
    writeFileSync(inputPath, mediaBuffer);

    const isVideo = mediaType === 'videoMessage';
    const args = isVideo
      ? `-i "${inputPath}" -vf "fps=10,scale=512:512:flags=lanczos" -c:v libwebp -lossless 1 -loop 0 -preset default -an -vsync 0 -s 512:512 "${outputPath}"`
      : `-i "${inputPath}" -vf "scale=512:512:flags=lanczos" -c:v libwebp -lossless 1 -q:v 80 "${outputPath}"`;

    execSync(`ffmpeg ${args}`, { timeout: isVideo ? 30000 : 15000, stdio: 'pipe' });

    const stickerBuffer = readFileSync(outputPath);
    await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer }, { quoted: m.key });

    unlinkSync(inputPath);
    unlinkSync(outputPath);
  } catch (e) {
    m.reply(`❌ *Erreur sticker:* ${e.message}`);
  }
}
