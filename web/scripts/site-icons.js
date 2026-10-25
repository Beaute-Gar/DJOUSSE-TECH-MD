'use strict';
/**
 * scripts/site-icons.js — génère les icônes PWA du site (website/icons/)
 * ────────────────────────────────────────────────────────────────────────
 * Source : website/logo.svg (la charte verte #25d366 / #0e9f4f / #04140c).
 *
 *   icon-192.png · icon-512.png   icônes classiques (coins arrondis)
 *   maskable-512.png              icône « maskable » plein cadre (safe zone)
 *   apple-touch-icon.png          iOS (180, plein cadre)
 *   favicon-32.png                favicon raster de secours
 *
 * Usage : node scripts/site-icons.js   (aucun argument, aucune dépendance
 * nouvelle — @napi-rs/canvas est déjà une dépendance du bot pour le Ludo).
 *
 * Le site reste vectoriel (logo.svg) : ces PNG servent au manifeste PWA,
 * à l'installation Android et au wrapping APK (TWA/Capacitor).
 */
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..', '..');
const SVG = fs.readFileSync(path.join(ROOT, 'web', 'public', 'assets', 'logo.svg'));
const OUT = path.join(ROOT, 'web', 'public', 'assets', 'icons');

const GREEN_A = '#25d366';
const GREEN_B = '#0e9f4f';
const INK = '#04140c';

/** Dessine le logo complet (tuile arrondie + glyphe) à la taille demandée. */
function drawTile(size, radiusRatio) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  const r = size * radiusRatio;
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, GREEN_A);
  grad.addColorStop(1, GREEN_B);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(size, 0, size, size, r);
  g.arcTo(size, size, 0, size, r);
  g.arcTo(0, size, 0, 0, r);
  g.arcTo(0, 0, size, 0, r);
  g.closePath();
  g.fill();
  return { c, g };
}

/** Plein cadre (maskable / iOS) : fond carré sans arrondi. */
function drawFull(size) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, GREEN_A);
  grad.addColorStop(1, GREEN_B);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return { c, g };
}

/** Insère le glyphe SVG (bulle + robot) avec la mise à l'échelle voulue. */
async function pasteGlyph(g, size, scale) {
  const img = await loadImage(SVG);
  const s = size * scale;
  const off = (size - s) / 2;
  g.drawImage(img, off, off, s, s);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // Icônes arrondies : la tuile du SVG occupe tout le cadre (rx = 22 %).
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512]]) {
    const tile = drawTile(size, 0.22);
    await pasteGlyph(tile.g, size, 0.86);
    fs.writeFileSync(path.join(OUT, name), tile.c.toBuffer('image/png'));
    console.log(`[ICONS] ${name} — ${size}×${size} ✓`);
  }

  // Maskable : plein cadre (l'OS arrondit), glyphe dans la safe zone (×0.62).
  const mask = drawFull(512);
  await pasteGlyph(mask.g, 512, 0.62);
  fs.writeFileSync(path.join(OUT, 'maskable-512.png'), mask.c.toBuffer('image/png'));
  console.log('[ICONS] maskable-512.png — 512×512 ✓');

  // iOS : plein cadre, glyphe ×0.80.
  const apple = drawFull(180);
  await pasteGlyph(apple.g, 180, 0.8);
  fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), apple.c.toBuffer('image/png'));
  console.log('[ICONS] apple-touch-icon.png — 180×180 ✓');

  // Favicon raster.
  const fav = drawTile(32, 0.22);
  await pasteGlyph(fav.g, 32, 0.86);
  fs.writeFileSync(path.join(OUT, 'favicon-32.png'), fav.c.toBuffer('image/png'));
  console.log('[ICONS] favicon-32.png — 32×32 ✓');

  // Contrôle d'intégrité : magic bytes PNG sur chaque fichier.
  for (const f of fs.readdirSync(OUT)) {
    const b = fs.readFileSync(path.join(OUT, f));
    if (!(b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)) {
      throw new Error(`${f} : magic bytes PNG invalides`);
    }
  }
  console.log('[ICONS] ✅ 5 icônes générées, PNG vérifiés (magic bytes)');
}

main().catch((e) => {
  console.error(`[ICONS] ❌ ${e.message}`);
  process.exitCode = 1;
});
