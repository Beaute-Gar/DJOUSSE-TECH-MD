const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BOT_IMAGES = [
    path.join(ASSETS_DIR, 'bot1.png'),
    path.join(ASSETS_DIR, 'bot2.png'),
];
let imageIndex = 0;

function randomImage() {
    const available = BOT_IMAGES.filter(f => fs.existsSync(f));
    if (available.length === 0) return 'https://i.imgur.com/placeholder.png';
    const img = available[imageIndex % available.length];
    imageIndex++;
    return img;
}

module.exports = { randomImage };
