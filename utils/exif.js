const fs = require('fs');
const path = require('path');
const { webp } = require('node-webpmux');

const writeExifImg = async (buffer, metadata = {}) => {
  try {
    const img = new webp();
    img.load(buffer);
    
    const json = {
      'sticker-pack-id': 'DJOUSSE-TECH-MD',
      'sticker-pack-name': metadata.packname || 'DJOUSSE TECH',
      'sticker-pack-publisher': metadata.author || 'Beaute Gar',
      'emojis': metadata.emojis || ['🤖']
    };
    
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    exifAttr.writeUInt32BE(jsonBuff.length, 14);
    
    const finalBuffer = Buffer.concat([img.exifAttr || Buffer.alloc(0), exifAttr, jsonBuff]);
    
    return finalBuffer;
  } catch (e) {
    return buffer;
  }
};

module.exports = { writeExifImg };