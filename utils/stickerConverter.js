const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const imageToSticker = async (buffer, metadata = {}) => {
  try {
    const resized = await sharp(buffer)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toBuffer();
    
    return resized;
  } catch (e) {
    return buffer;
  }
};

const videoToSticker = (buffer, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const inputFile = path.join(TMP_DIR, `vid_${Date.now()}.mp4`);
    const outputFile = path.join(TMP_DIR, `stk_${Date.now()}.webp`);
    
    fs.writeFileSync(inputFile, buffer);
    
    exec(`${ffmpegPath} -i ${inputFile} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0" -c:v libwebp -lossless 0 -qscale 50 -preset default -loop 0 -an -vsync 0 ${outputFile}`, (err) => {
      try { fs.unlinkSync(inputFile); } catch (e) {}
      if (err) return reject(err);
      const result = fs.readFileSync(outputFile);
      try { fs.unlinkSync(outputFile); } catch (e) {}
      resolve(result);
    });
  });
};

module.exports = { imageToSticker, videoToSticker };