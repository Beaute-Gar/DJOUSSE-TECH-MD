'use strict';
/**
 * lib/wa-sticker.js — fabrique de stickers interne (remplace wa-sticker-formatter)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Pourquoi : wa-sticker-formatter@4.4.4 (dernière version publiée) entraînait
 * 4 vulnérabilités SANS correctif possible :
 *   - axios@0.21.4              (high,   chaîne d'advisories CSRF/SSRF/ReDoS)
 *   - file-type@16.5.4          (moderate, boucle infinie parser ASF)
 *   - image-size@1.2.1          (high,   boucles infinies JXL/HEIF/ICNS)
 *   - sharp@0.30.7 imbriqué      (high,   libwebp/libvips/libheif) + conflit
 *     de DLL libvips avec le sharp du projet (cf. l'ancien commentaire de
 *     handler.js « sharp DOIT être chargé AVANT wa-sticker-formatter »).
 * Ce module reproduit la même API et la même sémantique en s'appuyant sur des
 * dépendances déjà auditées/épinglées : sharp (projet), ffmpeg-static (projet)
 * et node-webpmux (méta WebP).
 *
 * API (identique aux 5 sites d'appel du projet) :
 *   const { Sticker, StickerTypes } = require('./wa-sticker');
 *   const buf = await new Sticker(image, {
 *     pack: 'DJOUSSE', author: 'MD', type: StickerTypes.FULL, quality: 75,
 *   }).toBuffer();
 *
 * Pipeline : décodage → redimensionnement selon `type` → WebP → contrôle des
 * limites WhatsApp (100 Ko statique / 500 Ko animé) → métadonnées pack/auteur
 * injectées dans le chunk EXIF (format reconnu par WhatsApp).
 */
const sharp = require('sharp');
const WebP = require('node-webpmux');
const { randomBytes } = require('crypto');
const { ffmpegBuffer } = require('./ffmpeg');

/* Types — valeurs identiques à celles de l'ancien paquet */
const StickerTypes = Object.freeze({
  DEFAULT: 'default',
  CROPPED: 'crop',
  FULL: 'full',
  CIRCLE: 'circle',
  ROUNDED: 'rounded',
});

const MAX_SIDE = 512;                 // WhatsApp : 512 × 512 px max
const LIMIT_STATIC = 100 * 1024;      // WhatsApp : sticker statique ≤ 100 Ko
const LIMIT_ANIMATED = 500 * 1024;     // WhatsApp : sticker animé ≤ 500 Ko
const VIDEO_MAX_SECONDS = 6;           // WhatsApp : sticker animé ≤ 6 s
const DEFAULT_BG = { r: 0, g: 0, b: 0, alpha: 0 }; // fond transparent

/* ── détection de format par signature d'octets (pas de file-type) ───────── */
const ascii = (buf, start, len) => buf.subarray(start, start + len).toString('latin1');

function isVideo(buf) {
  if (buf.length < 12) return false;
  if (ascii(buf, 4, 4) === 'ftyp') return true;                                    // mp4 / mov / 3gp / m4v
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true; // webm / mkv
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'AVI ') return true;      // avi
  return false;
}
function isAnimatedFormat(buf) {
  if (buf.length < 12) return false;
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return true;
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') return true;      // webp (animé ou non)
  return false;
}

/* ── vidéo → GIF animé via ffmpeg-static (palette 256 couleurs) ──────────── *
 * ffmpeg ne peut PAS écrire un WebP valide sur un pipe : il ne peut pas
 * retourner patcher la taille du conteneur RIFF ni les tailles de chunks
 * (testé : « Input buffer has corrupt header » même après réparation du
 * header). Le GIF, lui, est autonome par frame → fiable sur pipe.             */
async function videoToGif(data) {
  const vf = `scale=${MAX_SIDE}:${MAX_SIDE}:force_original_aspect_ratio=decrease:flags=bicubic,fps=12`;
  const fc = `[0:v]${vf},split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse`;
  try {
    /* palette dédiée : couleurs correctes (et fichier plus petit qu'en GIF basique) */
    return await ffmpegBuffer(
      data,
      ['-i', 'pipe:0', '-t', String(VIDEO_MAX_SECONDS), '-filter_complex', fc,
       '-f', 'gif', 'pipe:1'],
      48 * 1024 * 1024
    );
  } catch (_) {
    /* repli : GIF basique sans palette (encodeurs non standards) */
    return ffmpegBuffer(
      data,
      ['-i', 'pipe:0', '-t', String(VIDEO_MAX_SECONDS), '-vf', vf,
       '-f', 'gif', 'pipe:1'],
      48 * 1024 * 1024
    );
  }
}

/* ── conversion image/gif/webp → WebP selon le type ──────────────────────── */
async function toWebp(data, { type, quality, background }) {
  if (isVideo(data)) data = await videoToGif(data);
  const animated = isAnimatedFormat(data);
  let pipeline = sharp(data, { animated })
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'contain', background })
    .toFormat('webp');

  switch (type) {
    case StickerTypes.CROPPED:
      pipeline = sharp(data, { animated })
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'cover' })
        .toFormat('webp');
      break;
    case StickerTypes.CIRCLE:
      pipeline = sharp(data, { animated })
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'cover' })
        .composite([{
          input: Buffer.from(`<svg width="${MAX_SIDE}" height="${MAX_SIDE}"><circle cx="256" cy="256" r="256" fill="black"/></svg>`),
          blend: 'dest-in',
        }])
        .toFormat('webp');
      break;
    case StickerTypes.ROUNDED:
      pipeline = sharp(data, { animated })
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'cover' })
        .composite([{
          input: Buffer.from(`<svg width="${MAX_SIDE}" height="${MAX_SIDE}"><rect rx="50" ry="50" width="${MAX_SIDE}" height="${MAX_SIDE}" fill="black"/></svg>`),
          blend: 'dest-in',
        }])
        .toFormat('webp');
      break;
    case StickerTypes.FULL:
    case StickerTypes.DEFAULT:
    default:
      /* FULL/DEFAULT : on garde l'image entière, encadrée sur 512×512
         (l'ancien paquet ne redimensionnait PAS DEFAULT → dépassement possible) */
      break;
  }
  return pipeline.webp({ quality, lossless: false }).toBuffer();
}

/* ── respect des limites de taille WhatsApp (ré-encodage décroissant) ────── */
async function shrinkToLimit(webp, animated, quality) {
  const limit = animated ? LIMIT_ANIMATED : LIMIT_STATIC;
  let buf = webp;
  for (const q of [Math.max(30, quality - 25), 35]) {
    if (buf.length <= limit) break;
    try {
      buf = await sharp(buf, { animated }).webp({ quality: q, lossless: false }).toBuffer();
    } catch {
      break;
    }
  }
  return buf;
}

/* ── métadonnées pack/auteur (chunk EXIF, format WhatsApp) ───────────────── */
function exifBlob(meta) {
  const data = JSON.stringify({
    'sticker-pack-id': meta.id || randomBytes(32).toString('hex'),
    'sticker-pack-name': meta.pack || '',
    'sticker-pack-publisher': meta.author || '',
    emojis: meta.categories || [],
  });
  /* En-tête TIFF little-endian + note « WA » (tag 0x5741), taille du JSON
     écrite en little-endian à l'offset 14 — exactement le format attendu. */
  const exif = Buffer.concat([
    Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41,
      0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]),
    Buffer.from(data, 'utf8'),
  ]);
  exif.writeUIntLE(Buffer.byteLength(data, 'utf8'), 14, 4);
  return exif;
}

async function applyExif(webp, meta) {
  const img = new WebP.Image();
  await img.load(webp);
  img.exif = exifBlob(meta);
  return img.save(null);
}

/* ── classe publique (drop-in de l'ancienne Sticker) ─────────────────────── */
class Sticker {
  /**
   * @param {Buffer} data image / gif / webp / vidéo (buffer uniquement)
   * @param {{pack?:string, author?:string, id?:string, categories?:string[],
   *          type?:string, quality?:number, background?:object}} [metadata]
   */
  constructor(data, metadata = {}) {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Sticker : un Buffer est attendu (chemin et URL non supportés)');
    }
    this.data = data;
    this.metadata = {
      id: metadata.id,
      pack: metadata.pack || '',
      author: metadata.author || '',
      categories: metadata.categories || [],
      type: Object.values(StickerTypes).includes(metadata.type)
        ? metadata.type
        : StickerTypes.DEFAULT,
      quality: Number.isFinite(metadata.quality) ? metadata.quality : 100,
      background: metadata.background || DEFAULT_BG,
    };
  }

  /** Construit le sticker WebP complet (pixels + EXIF). @returns {Promise<Buffer>} */
  async build() {
    const meta = this.metadata;
    const animated = isVideo(this.data) || isAnimatedFormat(this.data);
    const webp = await toWebp(this.data, meta);
    const sized = await shrinkToLimit(webp, animated, meta.quality);
    return applyExif(sized, meta);
  }

  /** Alias de build() (API historique). */
  toBuffer() {
    return this.build();
  }

  /** Écrit le sticker sur disque. @returns {Promise<string>} chemin écrit */
  async toFile(filename = `./${this.metadata.pack}-${this.metadata.author}.webp`) {
    const { writeFile } = require('fs/promises');
    await writeFile(filename, await this.build());
    return filename;
  }
}

/** Fabrique le sticker en une seule appelation. */
function createSticker(...args) {
  return new Sticker(...args).build();
}

module.exports = { Sticker, StickerTypes, createSticker };
