/**
 * Conversion image/vidéo en sticker - Version légère (sans sharp/ffmpeg)
 */

const imageToSticker = async (buffer, metadata = {}) => {
  // Sans sharp, on envoie l'image brute comme sticker
  return buffer;
};

const videoToSticker = async (buffer, metadata = {}) => {
  // Sans ffmpeg, on envoie la vidéo brute
  return buffer;
};

module.exports = { imageToSticker, videoToSticker };
