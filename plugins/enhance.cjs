const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGE ENHANCE (LOCAL)
   Uses sharp (already installed) for local image upscaling.
   No API key required — 100% local, fast, free.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'enhance',
  alias: ['upscale', 'hd'],
  react: '✨',
  desc: 'Améliorer la qualité d\'une image (local, gratuit)',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) return reply('❌ Réponds (quote) à une image avec .enhance');

  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement de l\'image impossible.');

    const sharp = require('sharp');
    const metadata = await sharp(buffer).metadata();
    const newWidth = Math.min(metadata.width * 2, 2048);
    const newHeight = Math.min(metadata.height * 2, 2048);

    const enhanced = await sharp(buffer)
      .resize(newWidth, newHeight, { kernel: 'lanczos3' })
      .sharpen({ sigma: 1.5 })
      .modulate({ brightness: 1.05 })
      .jpeg({ quality: 95 })
      .toBuffer();

    await conn.sendMessage(m.chat, { image: enhanced, caption: '✨ *Image améliorée !*\n📐 ' + newWidth + 'x' + newHeight + ' (x2 upscale local)' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
