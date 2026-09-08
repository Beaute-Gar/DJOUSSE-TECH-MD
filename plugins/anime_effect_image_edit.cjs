const { cmd } = require('../command.cjs');
const sharp = require('sharp');

/* anime_effect_image_edit.cjs — Appliquer un filtre style anime à une image
   Utilise sharp (déjà installé) — traitement 100% local, aucune API externe. */

cmd({
  pattern: 'animestyle',
  alias: ['animefilter', 'animeffect'],
  react: '🎨',
  desc: 'Appliquer un filtre style anime à une image',
  category: 'image',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) return reply('❌ Réponds (quote) à une image avec .animestyle');

  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement impossible.');

    // Effet anime : contraste élevé + saturation + douceur
    const processed = await sharp(buffer)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .modulate({ brightness: 1.1, saturation: 1.8, hue: 15 })
      .sharpen({ sigma: 2.0 })
      .png()
      .toBuffer();

    await conn.sendMessage(m.chat, { image: processed, caption: '🎨 *Filtre anime appliqué*' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});
