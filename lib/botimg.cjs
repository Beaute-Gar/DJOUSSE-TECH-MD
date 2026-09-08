// lib/botimg.cjs — Image de marque du bot (media/djousse.jpg)
// Utilisée par .alive, .yts, etc. Retourne un Buffer prêt pour WhatsApp.
const fs = require('fs');
const path = require('path');

let cached = null;

function botImg() {
  if (cached) return cached;
  try {
    const f = path.join(__dirname, '..', 'media', 'djousse.jpg');
    if (fs.existsSync(f)) cached = fs.readFileSync(f);
  } catch (_) { cached = null; }
  return cached;
}

module.exports = { botImg };
