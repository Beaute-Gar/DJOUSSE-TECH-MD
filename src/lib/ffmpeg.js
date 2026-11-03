'use strict';
/**
 * lib/ffmpeg.js — point d'accès unique à ffmpeg-static (buffer → buffer).
 *
 * Extrait de handler.js (lot B11 « dépendances ») pour être partagé par :
 *   - handler.js   : compression vidéo > 14 Mo avant envoi,
 *   - lib/wa-sticker.js : vidéo → sticker animé.
 * Une seule implémentation de spawn/garde-fou mémoire (G4 : pas de doublon).
 *
 * Convention : les `args` doivent lire l'entrée sur stdin (`-i pipe:0`) et
 * écrire sur stdout (`pipe:1`), l'appelant alimentant `input`.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

/**
 * @param {Buffer} input    flux d'entrée
 * @param {string[]} args   arguments ffmpeg (sans le binaire)
 * @param {number} [maxBytes] garde-fou mémoire sur la sortie (défaut 64 Mo)
 * @returns {Promise<Buffer>}
 */
function ffmpegBuffer(input, args, maxBytes = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args]);
    const chunks = [];
    let size = 0;
    let err = '';
    ff.stdout.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        try { ff.kill(); } catch {}
        reject(new Error('fichier trop volumineux après conversion'));
      } else chunks.push(c);
    });
    ff.stderr.on('data', (c) => { err += c.toString().slice(0, 400); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(err.trim() || `ffmpeg (code ${code})`));
    });
    ff.stdin.on('error', () => {});
    ff.stdin.end(input);
  });
}

/**
 * Exécute ffmpeg sur un fichier et écrit le résultat dans un AUTRE fichier.
 * Indispensable pour `-movflags +faststart` (atome moov en tête) : cette
 * option exige une sortie « seekable », impossible sur un pipe stdout.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string[]} args
 * @returns {Promise<string>} outputPath
 */
function ffmpegToFile(inputPath, outputPath, args) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      ...args,
      outputPath,
    ]);
    let err = '';
    ff.stderr.on('data', (c) => { err = (err + c.toString()).slice(-4000); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) {
        try {
          if (fs.statSync(outputPath).size > 0) return resolve(outputPath);
          reject(new Error('ffmpeg : sortie vide'));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(err.trim() || `ffmpeg (code ${code})`));
      }
    });
  });
}

/**
 * Sonde un média via `ffmpeg -i` (pas besoin de ffprobe).
 * ffmpeg sort toujours en code 1 sans fichier de sortie : on ne se fie
 * qu'aux métadonnées écrites sur stderr.
 *
 * @param {string} filePath
 * @returns {Promise<{format:string, video:string, audio:string, duration:number}>}
 */
function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ['-hide_banner', '-i', filePath]);
    let err = '';
    ff.stderr.on('data', (c) => { err = (err + c.toString()).slice(-12000); });
    ff.on('error', reject);
    ff.on('close', () => {
      const format = (err.match(/Input #0,\s*([^,\n]+)/) || [])[1] || '';
      const video = (err.match(/Stream #\d+:\d+[^\n]*?Video:\s*([a-zA-Z0-9_]+)/) || [])[1] || '';
      const audio = (err.match(/Stream #\d+:\d+[^\n]*?Audio:\s*([a-zA-Z0-9_]+)/) || [])[1] || '';
      const hms = (err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/) || []);
      const duration = hms.length
        ? Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])
        : 0;
      resolve({
        format,
        video,
        audio,
        duration,
        raw: err,
      });
    });
  });
}

module.exports = { ffmpegBuffer, ffmpegPath, ffmpegToFile, probeMedia };
