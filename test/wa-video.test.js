'use strict';
/**
 * test/wa-video.test.js — PREUVE DU CORRECTIF VIDÉO
 * ─────────────────────────────────────────────────
 * WhatsApp refusait les vidéos téléchargées (WebM renommé, AV1/VP9,
 * MP4 fragmenté). On prouve ici, avec de vrais fichiers générés par
 * ffmpeg, que :
 *   - un MP4 H.264/AAC propre n'est PAS réencodé (aucun coût) ;
 *   - un WebM/VP9 est converti en MP4 H.264 lisible par WhatsApp ;
 *   - la sortie porte bien la signature MP4 (`ftyp`) et le codec h264.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const { probeMedia } = require('../src/lib/ffmpeg');
const {
  normalizeVideoBuffer,
  isMp4Buffer,
  hasH264,
  looksWhatsAppCompatible,
} = require('../src/lib/wa-video');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-video-test-'));
}

function run(args) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || 'ffmpeg a échoué');
}

test('signature : MP4 = ftyp, WebM n’est pas un MP4', () => {
  assert.equal(isMp4Buffer(Buffer.from('....ftypisom')), true);
  assert.equal(isMp4Buffer(Buffer.from('\x1aE\xdf\xa3webm')), false);
  assert.equal(looksWhatsAppCompatible(Buffer.from('....ftypisom')), false, 'sans avc1 → à normaliser');
});

test('MP4 H.264 déjà propre : renvoyé tel quel (pas de réencodage)', async () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'ok.mp4');
    run([
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file,
    ]);
    const input = fs.readFileSync(file);
    assert.equal(isMp4Buffer(input), true);
    assert.equal(hasH264(input), true);
    assert.equal(looksWhatsAppCompatible(input), true);
    const out = await normalizeVideoBuffer(input);
    assert.equal(out, input, 'le même buffer doit être retourné');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('WebM/VP9 → MP4 H.264 lisible par WhatsApp', async () => {
  const dir = tempDir();
  try {
    const webm = path.join(dir, 'in.webm');
    run([
      '-f', 'lavfi', '-i', 'testsrc=size=321x241:rate=15:duration=1',
      '-c:v', 'libvpx', '-b:v', '200k', '-pix_fmt', 'yuv420p', webm,
    ]);
    const input = fs.readFileSync(webm);
    assert.equal(isMp4Buffer(input), false, 'entrée bien en WebM');

    const out = await normalizeVideoBuffer(input);
    assert.equal(isMp4Buffer(out), true, 'sortie MP4');
    assert.equal(hasH264(out), true, 'sortie H.264');

    const mp4 = path.join(dir, 'out.mp4');
    fs.writeFileSync(mp4, out);
    const info = await probeMedia(mp4);
    assert.match(info.video, /h264/i, `codec vidéo : ${info.video}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
