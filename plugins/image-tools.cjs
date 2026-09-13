const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   OUTILS IMAGE
   Fond transparent : remove.bg — vrai plan gratuit (50 images/mois), clé
                       requise. Aucune alternative gratuite illimitée fiable
                       n'existe pour une qualité correcte.
   OCR (texte)      : tesseract.js — 100% gratuit, tourne EN LOCAL (WASM),
                       aucune clé, aucun envoi de données à un tiers.
   Sticker          : sharp (déjà une dépendance du projet) — conversion
                       auto-contenue, aucune API externe.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'removebg',
  alias: ['fondtransparent', 'nobg'],
  react: '🖼️',
  desc: 'Retirer le fond d\'une image',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) {
    return reply(box('🖼️ *FOND TRANSPARENT*', [
      { raw: 'REMOVEBG_API_KEY non configurée.' },
      { label: 'Clé gratuite', value: 'https://www.remove.bg/fr/api (50 images/mois gratuites)' },
    ]));
  }
  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) return reply('❌ Réponds (quote) à une image avec .removebg, ou envoie une image avec .removebg en légende.');

  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement de l\'image impossible.');

    const form = new FormData();
    form.append('image_file', new Blob([buffer]), 'image.png');
    form.append('size', 'auto');

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.errors?.[0]?.title || `Erreur API (HTTP ${res.status})`);
    }
    const outBuffer = Buffer.from(await res.arrayBuffer());
    await conn.sendMessage(m.chat, { image: outBuffer, caption: '✅ Fond retiré' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

cmd({
  pattern: 'ocr',
  alias: ['texteimage', 'extraitexte'],
  react: '📝',
  desc: 'Extraire le texte contenu dans une image (gratuit, local, aucune donnée envoyée en ligne)',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) return reply(box('📝 *OCR — TEXTE DEPUIS IMAGE*', [{ raw: 'Réponds (quote) à une image contenant du texte avec .ocr' }]));

  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement de l\'image impossible.');

    const { createWorker } = require('tesseract.js');
    const lang = process.env.OCR_LANG || 'fra+eng';
    const worker = await createWorker(lang);
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const text = (data.text || '').trim();
    await m.react('✅').catch(() => {});
    if (!text) return reply('❌ Aucun texte détecté dans cette image.');
    reply(box('📝 *TEXTE EXTRAIT*', [
      { raw: truncate(text, 3000) },
      { blank: true },
      { label: 'Confiance', value: Math.round(data.confidence) + '%' },
    ]));
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

// .sticker DÉSACTIVÉ — conflit avec sticker-extended.cjs
