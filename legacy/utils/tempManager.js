const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', 'tmp');

const initializeTempSystem = () => {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
};

const getTempPath = (filename) => {
  return path.join(TMP_DIR, filename);
};

module.exports = { initializeTempSystem, getTempPath, TMP_DIR };