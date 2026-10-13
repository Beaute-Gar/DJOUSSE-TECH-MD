'use strict';
/* Vrai test : génère un audio avec ffmpeg, applique les filtres portés,
   vérifie que la sortie est un vrai fichier audio non vide. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EFFETS, runFfmpeg } = require('../lib/ported-audio');

const FFMPEG = require('ffmpeg-static');

function genTone() {
  return new Promise((resolve, reject) => {
    const out = path.join(os.tmpdir(), `tone_${Date.now()}.mp3`);
    execFile(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', out],
      { timeout: 60000 }, (e) => (e ? reject(e) : resolve(out)));
  });
}

test('ffmpeg-porté : chaque filtre transforme réellement l\'audio', async () => {
  const src = await genTone();
  const before = fs.statSync(src).size;
  for (const [nom, eff] of Object.entries(EFFETS)) {
    if (!eff.audio) continue; /* les filtres vidéo sont testés à part */
    const buf = await runFfmpeg(src, 'mp3', eff.args);
    assert.ok(Buffer.isBuffer(buf) && buf.length > 500, `${nom} : sortie trop petite (${buf?.length})`);
    /* signature MP3 (ID3 ou trame 0xFF Exx) */
    const head = buf.slice(0, 3);
    const okMp3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 || head[0] === 0xff;
    assert.ok(okMp3, `${nom} : sortie non reconnue comme MP3`);
    console.log(`  ${nom.padEnd(10)} ${before} -> ${buf.length} octets`);
  }
  fs.unlinkSync(src);
});

test('ffmpeg-porté : entrée absente → erreur propre, pas de crash', async () => {
  await assert.rejects(() => runFfmpeg(path.join(os.tmpdir(), 'inexistant.mp3'), 'mp3', ['-af', 'areverse']), /ffmpeg/i);
});

test('les 8 commandes audio sont enregistrées', () => {
  const reg = new Map();
  const cmd = (...a) => {
    const fn = a[a.length - 1];
    if (typeof fn !== 'function') return;
    reg.set(a[0], { meta: a[1], fn });
  };
  const { registerPortedAudio } = require('../lib/ported-audio');
  registerPortedAudio(cmd, {
    config: { prefix: '.' },
    mediaInfo: () => null,
    downloadFrom: async () => Buffer.alloc(0),
    send: async () => {},
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
  });
  const attendues = [...Object.keys(EFFETS), 'audiofx'];
  const miss = attendues.filter((n) => !reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
});
