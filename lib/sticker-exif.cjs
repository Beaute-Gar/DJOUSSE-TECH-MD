'use strict';

/* Ajoute les métadonnées EXIF pack/auteur à un buffer WebP, format attendu
   par WhatsApp pour afficher correctement le nom du pack de stickers. */
async function addExifToWebp(webpBuffer, packname, author) {
  const webpmux = require('node-webpmux');
  const img = new webpmux.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': 'djousse-tech-' + Date.now(),
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['😀'],
  };
  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);

  img.exif = exif;
  return img.save(null);
}

module.exports = { addExifToWebp };
