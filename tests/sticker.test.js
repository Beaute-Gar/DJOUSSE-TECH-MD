'use strict';
/**
 * Tests de lib/wa-sticker.js — fabrique interne qui remplace wa-sticker-formatter
 * (lot B11 « dépendances »). On charge les VRAIS sharp / ffmpeg-static /
 * node-webpmux : ce fichier n'importe donc PAS ./helpers (qui les stub).
 */
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const WebP = require('node-webpmux');
const { Sticker, StickerTypes, createSticker } = require('../lib/wa-sticker');
const { ffmpegBuffer } = require('../lib/ffmpeg');

const PACK = 'DJOUSSE-PACK';
const AUTHOR = 'MD-BOT';

const isWebp = (b) =>
  b.length > 16 && b.subarray(0, 4).toString('latin1') === 'RIFF' &&
  b.subarray(8, 12).toString('latin1') === 'WEBP';

test('sticker : image PNG → WebP ≤512 px, ratio conservé, ≤100 Ko', async () => {
  const png = await sharp({
    create: { width: 800, height: 400, channels: 3, background: { r: 20, g: 120, b: 200 } },
  }).png().toBuffer();

  const out = await new Sticker(png, { pack: PACK, author: AUTHOR, type: StickerTypes.FULL, quality: 75 })
    .toBuffer();

  assert.ok(isWebp(out), 'sortie WebP (signature RIFF/WEBP)');
  const meta = await sharp(out).metadata();
  assert.strictEqual(meta.width, 512, 'canvas 512 px (contain + fond transparent)');
  assert.strictEqual(meta.height, 512, 'canvas 512 px (contain + fond transparent)');
  assert.ok(out.length <= 100 * 1024, `≤100 Ko (WhatsApp), obtenu ${out.length} o`);
  // le contenu conserve son ratio : après suppression du fond transparent,
  // on doit retrouver 800×400 → 512×256
  const tm = await sharp(out).trim().toBuffer().then((b) => sharp(b).metadata());
  assert.ok(
    Math.abs(tm.width / tm.height - 2) < 0.05,
    `contenu ${tm.width}×${tm.height} (ratio 2 attendu)`
  );
});

test('sticker : métadonnées pack/auteur dans le chunk EXIF', async () => {
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 30, b: 30 } },
  }).png().toBuffer();

  const out = await createSticker(png, { pack: PACK, author: AUTHOR, type: StickerTypes.FULL });

  const img = new WebP.Image();
  await img.load(out);
  const exif = Buffer.from(img.exif || []);
  const text = exif.toString('latin1');
  assert.ok(text.includes('"sticker-pack-name":"' + PACK + '"'), 'nom de pack présent');
  assert.ok(text.includes('"sticker-pack-publisher":"' + AUTHOR + '"'), 'auteur présent');
  assert.ok(text.includes('"sticker-pack-id"'), 'id de pack présent');
});

test('sticker : GIF animé → WebP animé (frames conservées)', async () => {
  const w = 64, h = 64, frames = 3;
  const raw = Buffer.alloc(w * h * 3 * frames);
  for (let f = 0; f < frames; f++) {
    raw.fill(f * 80, f * w * h * 3, (f + 1) * w * h * 3); // niveaux de gris croissants
  }
  const gif = await sharp(raw, { raw: { width: w, height: h * frames, channels: 3, pageHeight: h } })
    .gif({ loop: 0 }).toBuffer();

  const out = await new Sticker(gif, { pack: PACK, author: AUTHOR, type: StickerTypes.FULL }).toBuffer();

  assert.ok(isWebp(out));
  const meta = await sharp(out, { animated: true }).metadata();
  assert.strictEqual(meta.pages, frames, `${meta.pages} pages = ${frames} attendues`);
  assert.ok(out.length <= 500 * 1024, `sticker animé ≤500 Ko, obtenu ${out.length} o`);
});

test('sticker : vidéo MP4 → WebP animé via ffmpeg-static', async () => {
  // Génère une vidéo test de 1 s (lavfi) sans dépendre d'un fichier externe.
  const mp4 = await ffmpegBuffer(Buffer.alloc(0), [
    '-f', 'lavfi', '-i', 'testsrc=duration=1:size=128x96:rate=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-movflags', 'frag_keyframe+empty_moov', // mp4 fragmenté : écrit sur un pipe non seekable
    '-f', 'mp4', 'pipe:1',
  ], 16 * 1024 * 1024);
  assert.strictEqual(mp4.subarray(4, 8).toString('latin1'), 'ftyp', 'mp4 de test valide');

  const out = await new Sticker(mp4, { pack: PACK, author: AUTHOR, type: StickerTypes.FULL }).toBuffer();

  assert.ok(isWebp(out), 'sortie WebP');
  const meta = await sharp(out, { animated: true }).metadata();
  assert.ok(meta.pages >= 2, `animation conservée (${meta.pages} pages)`);
  // sur une image animée, sharp rapporte la hauteur totale (frames empilées) :
  // la hauteur d'une frame est pageHeight
  const frameHeight = meta.pageHeight || meta.height;
  assert.ok(meta.width <= 512 && frameHeight <= 512,
    `frame ${meta.width}×${frameHeight} ≤ 512×512`);
  assert.ok(out.length <= 500 * 1024, `sticker animé ≤500 Ko, obtenu ${out.length} o`);
});

test('sticker : API de compatibilité (types, garde-fous, toFile)', async () => {
  assert.strictEqual(StickerTypes.FULL, 'full');
  assert.strictEqual(StickerTypes.CROPPED, 'crop');
  assert.throws(() => new Sticker('chemin.png'), /Buffer/, 'refuse un chemin (buffer uniquement)');

  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
  }).png().toBuffer();
  const sticker = new Sticker(png, { quality: 70 }); // métadonnées optionnelles
  const buf = await sticker.toBuffer();
  assert.ok(isWebp(buf));
  assert.strictEqual(typeof sticker.build, 'function', 'alias build() présent');
});
