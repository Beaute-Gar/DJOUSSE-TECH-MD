/**
 * EXIF pour stickers - Version légère (sans node-webpmux)
 */

const writeExifImg = async (buffer, metadata = {}) => {
  // Sans node-webpmux, on retourne le buffer brut
  // Le sticker sera envoyé sans métadonnées EXIF
  return buffer;
};

module.exports = { writeExifImg };
