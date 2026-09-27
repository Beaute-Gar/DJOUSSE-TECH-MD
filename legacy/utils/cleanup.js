const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', 'tmp');

const cleanupOldFiles = () => {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      return;
    }
    
    const files = fs.readdirSync(TMP_DIR);
    const now = Date.now();
    let cleaned = 0;
    
    for (const file of files) {
      const filePath = path.join(TMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        const age = now - stat.mtimeMs;
        if (age > 30 * 60 * 1000) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (e) {}
    }
    
    if (cleaned > 0) {
      console.log(`Nettoyage: ${cleaned} fichiers supprimés`);
    }
  } catch (e) {}
};

const startCleanup = () => {
  setInterval(cleanupOldFiles, 10 * 60 * 1000);
  cleanupOldFiles();
};

module.exports = { cleanupOldFiles, startCleanup };