import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomString, detectMime } from '../lib/utils.js';

const execFileAsync = promisify(execFile);

export const name = 'sticker';
export const aliases = ['s', 'stk', 'autocollant'];
export const category = 'Médias';
export const desc = 'Convertit image/GIF/vidéo en sticker.';
export const usage = '.sticker [pack] [auteur]';
export const cooldown = 5;

const DEFAULT_PACK = process.env.BOT_NAME || 'DTE Bot';
const DEFAULT_AUTHOR = 'DJOUSSE TECH EVOLUTION';

export async function handler(m, ctx) {
  const { args } = ctx;
  const src = _getMediaSource(m);
  if (!src) {
    return m.reply(`🎨 *Sticker DTE*\n\nEnvoie une image/GIF/vidéo (<10s) avec .sticker\n\nEx: .s MonPack MonNom`);
  }
  const packName = args[0] || DEFAULT_PACK;
  const authorName = args[1] || DEFAULT_AUTHOR;
  await m.react('⏳');
  let buffer;
  try { buffer = await src.download(); }
  catch { await m.react('❌'); return m.reply('❌ Téléchargement échoué.'); }
  const mime = detectMime(buffer);
  try {
    let stickerBuf;
    if (mime === 'image/gif') stickerBuf = await _gifToWebP(buffer, packName, authorName);
    else if (mime.startsWith('video/')) stickerBuf = await _videoToWebP(buffer, packName, authorName);
    else if (mime.startsWith('image/')) stickerBuf = await _imageToWebP(buffer, packName, authorName);
    else { await m.react('❌'); return m.reply('❌ Format non supporté.'); }
    await m.reply({ sticker: stickerBuf });
    await m.react('✅');
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Conversion: ${err.message}`);
  }
}

async function _imageToWebP(buffer, pack, author) {
  const webp = await sharp(buffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toBuffer();
  return _addExif(webp, pack, author);
}

async function _gifToWebP(buffer, pack, author) {
  return _ffmpeg(buffer, pack, author, ['-f', 'gif', '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0', '-vcodec', 'libwebp', '-preset', 'default', '-loop', '0', '-an', '-vsync', '0', '-t', '8', '-f', 'webp']);
}

async function _videoToWebP(buffer, pack, author) {
  return _ffmpeg(buffer, pack, author, ['-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0,fps=15', '-vcodec', 'libwebp', '-preset', 'default', '-loop', '0', '-an', '-vsync', '0', '-t', '8', '-f', 'webp']);
}

async function _ffmpeg(inputBuffer, pack, author, ffmpegArgs) {
  const tmpDir = os.tmpdir();
  const inFile = path.join(tmpDir, `dte_${randomString(6)}`);
  const outFile = path.join(tmpDir, `dte_${randomString(6)}.webp`);
  try {
    fs.writeFileSync(inFile, inputBuffer);
    await execFileAsync('ffmpeg', ['-y', '-i', inFile, ...ffmpegArgs, outFile], { timeout: 30_000 });
    const result = fs.readFileSync(outFile);
    return _addExif(result, pack, author);
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
}

function _addExif(webpBuffer, packName, authorName) {
  const json = JSON.stringify({ 'sticker-pack-id': `dte_${randomString(8)}`, 'sticker-pack-name': packName, 'sticker-pack-publisher': authorName, 'emojis': ['✨', '🤖'] });
  const exifStr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const jsonBuf = Buffer.from(json, 'utf-8');
  const exifData = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), jsonBuf]);
  try { return _injectWebPChunk(webpBuffer, 'EXIF', exifData); }
  catch { return webpBuffer; }
}

function _injectWebPChunk(webp, chunkId, data) {
  if (webp.length < 12 || webp.slice(0, 4).toString('ascii') !== 'RIFF') return webp;
  const chunkBuf = Buffer.alloc(8 + data.length);
  chunkBuf.write(chunkId.padEnd(4, ' '), 0, 'ascii');
  chunkBuf.writeUInt32LE(data.length, 4);
  data.copy(chunkBuf, 8);
  const newSize = webp.length - 8 + chunkBuf.length;
  const result = Buffer.concat([webp, chunkBuf]);
  result.writeUInt32LE(newSize, 4);
  return result;
}

function _getMediaSource(m) {
  if (['imageMessage', 'videoMessage', 'stickerMessage'].includes(m.type)) return m;
  if (m.quoted && ['imageMessage', 'videoMessage', 'stickerMessage'].includes(m.quoted.type)) return m.quoted;
  return null;
}
