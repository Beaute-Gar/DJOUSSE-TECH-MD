'use strict';
/**
 * Compatibilité sharp 0.35 — verrouille l'ensemble des API sharp utilisées par
 * le projet (menu SVG, filtres, composites, redimensionnements). Les tests
 * d'intégration stubbent sharp : sans ce fichier, une rupture d'API serait
 * invisible jusqu'en production.
 */
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');

const png = (w, h) => sharp({
  create: { width: w, height: h, channels: 3, background: { r: 40, g: 90, b: 160 } },
}).png().toBuffer();

const SVG = '<svg width="200" height="100"><rect width="200" height="100" fill="#3366ff"/>'
  + '<text x="10" y="50" fill="white">MENU</text></svg>';

test('sharp : SVG → JPEG (pipeline du menu, handler.js:681)', async () => {
  const out = await sharp(Buffer.from(SVG)).jpeg({ quality: 78 }).toBuffer();
  const m = await sharp(out).metadata();
  assert.strictEqual(m.format, 'jpeg');
  assert.strictEqual(m.width, 200);
});

test('sharp : redimensionnements cover / inside / fill / contain', async () => {
  const src = await png(800, 400);

  const cover = await sharp(src).resize(800, 450, { fit: 'cover' }).png().toBuffer(); // handler:647,711
  assert.deepStrictEqual(
    [ (await sharp(cover).metadata()).width, (await sharp(cover).metadata()).height ],
    [800, 450]
  );

  const inside = await sharp(src).resize(800, 450, { fit: 'inside' }).png().toBuffer(); // handler:652
  assert.strictEqual((await sharp(inside).metadata()).height, 400); // ratio conservé, pas de padding

  const fill = await sharp(src).resize(300, 300, { fit: 'fill' }).jpeg().toBuffer(); // tools:445
  assert.strictEqual((await sharp(fill).metadata()).width, 300);

  const contain = await sharp(src).resize(512, 512, {
    fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).webp().toBuffer(); // extras:69, missing:412
  assert.strictEqual((await sharp(contain).metadata()).format, 'webp');
});

test('sharp : composite (over + top/left) — tools:91, tools:380', async () => {
  const base = await png(512, 512);
  const overlay = await sharp(Buffer.from(SVG)).resize(100, 50).png().toBuffer();

  const over = await sharp(base)
    .composite([{ input: overlay, blend: 'over' }]).webp().toBuffer();
  assert.strictEqual((await sharp(over).metadata()).format, 'webp');

  const placed = await sharp(base)
    .composite([{ input: overlay, top: 80, left: 56 }]).png().toBuffer();
  assert.strictEqual((await sharp(placed).metadata()).format, 'png');
});

test('sharp : filtres image (tools:120-123, tools:370)', async () => {
  const src = await png(640, 360);
  const chain = {
    blur: (s) => s.resize(1024, 1024, { fit: 'inside' }).blur(8),
    grey: (s) => s.resize(1024, 1024, { fit: 'inside' }).greyscale(),
    invert: (s) => s.resize(1024, 1024, { fit: 'inside' }).negate(),
    sepia: (s) => s.resize(1024, 1024, { fit: 'inside' }).modulate({ saturation: 0.3 }).tint('#704214'),
  };
  for (const [name, fn] of Object.entries(chain)) {
    const out = await fn(sharp(src)).jpeg({ quality: 85 }).toBuffer();
    const m = await sharp(out).metadata();
    assert.strictEqual(m.format, 'jpeg', name);
    assert.ok(m.width <= 1024 && m.height <= 1024, `${name} ≤1024`);
  }
  // face 400×400 greyscale (tools:370)
  const face = await sharp(src).resize(400, 400, { fit: 'cover' }).greyscale().png().toBuffer();
  assert.strictEqual((await sharp(face).metadata()).width, 400);
});

test('sharp : entrée raw + trim (pipelines pixels et tests sticker)', async () => {
  const w = 64, h = 32;
  const raw = Buffer.alloc(w * h * 3, 200);
  const fromRaw = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .png().toBuffer();
  assert.strictEqual((await sharp(fromRaw).metadata()).width, w);

  const padded = await sharp(fromRaw).extend({
    top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
  const trimmed = await sharp(padded).trim().toBuffer();
  assert.strictEqual((await sharp(trimmed).metadata()).width, w, 'trim supprime le padding');
});
