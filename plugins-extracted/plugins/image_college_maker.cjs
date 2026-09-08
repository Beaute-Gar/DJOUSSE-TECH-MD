const { cmd } = require('../command.cjs');
const sharp = require('sharp');
const os = require('os');
const path = require('path');
const fs = require('fs');

/* image_college_maker.cjs — Créer un collage d'images (2-6 images)
   Utilise sharp (déjà installé) — traitement 100% local, aucune API. */

const imageBuffers = [];

cmd({
  pattern: 'collage',
  react: '🖼️',
  desc: 'Créer un collage d\'images (ajoute 2-6 images puis tape .collage)',
  category: 'image',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  // Reset
  if (m.chat && global._collageImages?.[m.chat]) {
    delete global._collageImages[m.chat];
  }

  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) {
    const stored = global._collageImages?.[m.chat] || [];
    if (stored.length < 2) {
      return reply('🖼️ *COLLAGE*\n\nAjoute 2 à 6 images en les envoyant avec .collage en légende.\nEnsuite tape .collage pour créer le collage.');
    }
    // Créer le collage
    try {
      await m.react('🕐').catch(() => {});
      const buffers = stored.map(s => s.buffer);
      const count = buffers.length;
      const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const tileW = 400, tileH = 300;

      const composites = [];
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const img = await sharp(buffers[i]).resize(tileW, tileH, { fit: 'cover' }).toBuffer();
        composites.push({ input: img, left: col * tileW, top: row * tileH });
      }

      const collage = await sharp({
        create: { width: cols * tileW, height: rows * tileH, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).composite(composites).jpeg({ quality: 90 }).toBuffer();

      await conn.sendMessage(m.chat, { image: collage, caption: '🖼️ *Collage créé (' + count + ' images)*' }, { quoted: m });
      await m.react('✅').catch(() => {});
      delete global._collageImages[m.chat];
    } catch (e) {
      await m.react('❌').catch(() => {});
      reply('❌ Erreur: ' + e.message);
    }
    return;
  }

  // Stocker l'image
  try {
    const buffer = await target.download();
    if (!buffer) return reply('❌ Impossible de télécharger l\'image.');
    if (!global._collageImages) global._collageImages = {};
    if (!global._collageImages[m.chat]) global._collageImages[m.chat] = [];
    global._collageImages[m.chat].push({ buffer, sender: m.sender });
    const count = global._collageImages[m.chat].length;
    await m.react('✅').catch(() => {});
    if (count < 2) {
      reply('📸 Image ' + count + '/6 ajoutée. Ajoute-en au moins 1 de plus puis tape .collage');
    } else {
      reply('📸 Image ' + count + '/6 ajoutée. Tape .collage pour créer le collage, ou ajoute d\'autres images.');
    }
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
