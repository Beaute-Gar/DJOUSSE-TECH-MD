'use strict';
/**
 * lib/wa-video.js — NORMALISATION VIDÉO POUR WHATSAPP
 * ───────────────────────────────────────────────────
 * Problème constaté : le fichier est bien téléchargé et envoyé, mais
 * WhatsApp répond « cette vidéo n'est pas disponible / problème avec le
 * fichier vidéo ». Causes réelles :
 *
 *   1. conteneur WebM/Matroska renommé en .mp4 (yt-dlp choisit parfois
 *      une piste unique VP9/Opus sans la remuxer) ;
 *   2. codec AV1/VP9/HEVC dans un conteneur MP4 : WhatsApp n'ouvre pas ;
 *   3. MP4 fragmenté (`frag_keyframe+empty_moov`) produit par l'ancienne
 *      compression : le lecteur WhatsApp de certains téléphones le refuse ;
 *   4. dimensions impaires / pixel format non compatible (yuv444, 10 bits) ;
 *   5. fichier > ~16 Mo (limite média WhatsApp).
 *
 * La normalisation ne s'applique qu'aux vidéos qui en ont besoin :
 * un MP4 H.264/AAC < 15 Mo passe tel quel (aucun coût CPU).
 * Pour les autres, ffmpeg produit un vrai MP4 H.264 + AAC, yuv420p,
 * moov en tête (`+faststart`) et dimensionne le débit pour rester sous
 * la limite WhatsApp quand la durée est connue.
 *
 * Désactivable par WA_VIDEO_NORMALIZE=off.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/* ffmpeg est chargé À LA DEMANDE : si le binaire manque, les messages
   texte continuent de partir normalement (seule la vidéo est concernée). */
let ffmpegTools = null;
function tools() {
  if (!ffmpegTools) ffmpegTools = require('./ffmpeg');
  return ffmpegTools;
}

/* Limite média WhatsApp ≈ 16 Mo : on vise 15 Mo avec une marge. */
const MAX_BYTES = 15 * 1024 * 1024;

const isOff = (value) => ['0', 'off', 'false', 'no'].includes(String(value || '').trim().toLowerCase());

/** Signature d'un conteneur MP4/ISO-BMFF (`....ftyp`). */
function isMp4Buffer(buf) {
  return Buffer.isBuffer(buf)
    && buf.length >= 12
    && buf.toString('latin1', 4, 8) === 'ftyp';
}

/** H.264 est le seul codec vidéo ouvert partout par WhatsApp. */
function hasH264(buf) {
  return Buffer.isBuffer(buf)
    && (buf.includes(Buffer.from('avc1', 'latin1')) || buf.includes(Buffer.from('avc3', 'latin1')));
}

/**
 * Un MP4 H.264 déjà propre n'a pas besoin d'être réencodé. On ne vérifie
 * pas l'audio ici : l'absence de piste audio reste valide, et un AAC dans
 * un MP4 H.264 est le cas normal produit par yt-dlp.
 */
function looksWhatsAppCompatible(buf) {
  return isMp4Buffer(buf) && hasH264(buf) && buf.length <= MAX_BYTES;
}

function scaleFilter(height) {
  return `scale=w='min(${height},iw)':h='min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
}

function transcodeArgs(profile) {
  const videoArgs = profile.crf != null
    ? ['-crf', String(profile.crf)]
    : [
      '-b:v', `${profile.videoKbps}k`,
      '-maxrate', `${profile.videoKbps}k`,
      '-bufsize', `${Math.max(profile.videoKbps * 2, 200)}k`,
    ];
  return [
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', scaleFilter(profile.height),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    ...videoArgs,
    '-c:a', 'aac',
    '-b:a', `${profile.audioKbps}k`,
    '-ac', '2',
    '-ar', '44100',
    '-sn', '-dn',
    '-movflags', '+faststart',
    '-f', 'mp4',
  ];
}

function buildProfiles(info) {
  const duration = Number(info.duration) || 0;
  if (duration > 0) {
    /* Budget total en kbit/s pour tenir sous MAX_BYTES, marge 8 %. */
    const budgetKbps = (MAX_BYTES * 8 * 0.92) / duration / 1000;
    const audioKbps = duration > 600 ? 48 : 64;
    const totalKbps = Math.min(Math.max(budgetKbps, 120), 1200);
    const videoKbps = Math.max(60, Math.round(totalKbps - audioKbps));
    const height = videoKbps < 220 ? 360 : 480;
    return [
      { height, videoKbps, audioKbps },
      { height: 360, videoKbps: Math.max(40, Math.round(videoKbps * 0.65)), audioKbps: 48 },
    ];
  }

  /* Durée inconnue : qualité constante, puis repli plus petit. */
  return [
    { height: 480, crf: 28, audioKbps: 64 },
    { height: 360, crf: 32, audioKbps: 48 },
  ];
}

/**
 * Rend un buffer vidéo lisible par WhatsApp.
 * Retourne TOUJOURS un buffer : en cas d'échec ffmpeg, l'original est
 * renvoyé (mieux vaut tenter l'envoi que bloquer la commande).
 *
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 */
async function normalizeVideoBuffer(input) {
  if (!Buffer.isBuffer(input) || input.length < 1024) return input;
  if (isOff(process.env.WA_VIDEO_NORMALIZE)) return input;
  if (looksWhatsAppCompatible(input)) return input;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-video-'));
  try {
    const inputPath = path.join(dir, 'input.bin');
    fs.writeFileSync(inputPath, input);

    const { ffmpegToFile, probeMedia } = tools();
    const info = await probeMedia(inputPath).catch(() => ({}));
    const videoOk = /^(h264|avc1|avc3)$/i.test(info.video || '');
    const audioOk = !info.audio || /^(aac|mp4a)$/i.test(info.audio);
    if (info.format && isMp4Buffer(input) && videoOk && audioOk && input.length <= MAX_BYTES) {
      return input;
    }

    let meilleur = null;
    let index = 0;
    for (const profile of buildProfiles(info)) {
      index += 1;
      const outputPath = path.join(dir, `out-${index}.mp4`);
      await ffmpegToFile(inputPath, outputPath, transcodeArgs(profile));
      const buf = fs.readFileSync(outputPath);
      if (!meilleur || buf.length < meilleur.length) meilleur = buf;
      if (buf.length <= MAX_BYTES) return buf;
      try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
    }

    if (meilleur) {
      console.warn(`[WA-VIDEO] ${meilleur.length} octets après compression (limite ${MAX_BYTES})`);
      return meilleur;
    }
    return input;
  } catch (e) {
    console.warn('[WA-VIDEO] normalisation impossible:', e.message);
    return input;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

module.exports = {
  normalizeVideoBuffer,
  isMp4Buffer,
  hasH264,
  looksWhatsAppCompatible,
  MAX_BYTES,
};
