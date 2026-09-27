const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

module.exports = { TMP_DIR };