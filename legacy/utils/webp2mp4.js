const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const webpToMp4 = (buffer) => {
  return new Promise((resolve, reject) => {
    const inputFile = path.join(TMP_DIR, `webp_${Date.now()}.webp`);
    const outputFile = path.join(TMP_DIR, `mp4_${Date.now()}.mp4`);
    fs.writeFileSync(inputFile, buffer);
    exec(`${ffmpegPath} -i ${inputFile} -c:v libx264 -pix_fmt yuv420p ${outputFile}`, (err) => {
      try { fs.unlinkSync(inputFile); } catch (e) {}
      if (err) return reject(err);
      const result = fs.readFileSync(outputFile);
      try { fs.unlinkSync(outputFile); } catch (e) {}
      resolve(result);
    });
  });
};

module.exports = { webpToMp4 };
