const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function botImg() {
  try {
    const files = fs.readdirSync(ASSETS_DIR).filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    if (files.length === 0) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    return path.join(ASSETS_DIR, file);
  } catch { return null; }
}

module.exports = { botImg };
