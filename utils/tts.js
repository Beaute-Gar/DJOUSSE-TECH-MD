const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const textToSpeech = async (text, lang = 'fr') => {
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!res.ok) return null;
    
    const buffer = await res.buffer();
    const outFile = path.join(TMP_DIR, `tts_${Date.now()}.mp3`);
    fs.writeFileSync(outFile, buffer);
    
    return outFile;
  } catch (e) {
    return null;
  }
};

module.exports = { textToSpeech };