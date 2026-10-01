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

module.exports = { ffmpegBuffer, ffmpegPath };
