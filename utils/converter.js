const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const toAudio = (buffer, ext) => {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(TMP_DIR, `${Date.now()}.${ext}`);
    const outFile = path.join(TMP_DIR, `${Date.now()}.mp3`);
    
    fs.writeFileSync(tmpFile, buffer);
    
    exec(`${ffmpegPath} -i ${tmpFile} -vn -ar 44100 -ac 2 -b:a 128k ${outFile}`, (err) => {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      if (err) return reject(err);
      const result = fs.readFileSync(outFile);
      try { fs.unlinkSync(outFile); } catch (e) {}
      resolve(result);
    });
  });
};

const toPTT = (buffer, ext) => {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(TMP_DIR, `${Date.now()}.${ext}`);
    const outFile = path.join(TMP_DIR, `${Date.now()}.ogg`);
    
    fs.writeFileSync(tmpFile, buffer);
    
    exec(`${ffmpegPath} -i ${tmpFile} -vn -ar 48000 -ac 1 -b:a 64k ${outFile}`, (err) => {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      if (err) return reject(err);
      const result = fs.readFileSync(outFile);
      try { fs.unlinkSync(outFile); } catch (e) {}
      resolve(result);
    });
  });
};

const toVideo = (buffer, ext) => {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(TMP_DIR, `${Date.now()}.${ext}`);
    const outFile = path.join(TMP_DIR, `${Date.now()}.mp4`);
    
    fs.writeFileSync(tmpFile, buffer);
    
    exec(`${ffmpegPath} -i ${tmpFile} -c:v libx264 -preset fast -crf 23 ${outFile}`, (err) => {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      if (err) return reject(err);
      const result = fs.readFileSync(outFile);
      try { fs.unlinkSync(outFile); } catch (e) {}
      resolve(result);
    });
  });
};

module.exports = { toAudio, toPTT, toVideo };