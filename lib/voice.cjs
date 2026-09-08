// lib/voice.cjs — TTS Google (validé) + musique de fond mixée via ffmpeg
// Produit des MP3 propres et LISIBLES partout (WhatsApp, lecteurs externes).
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function tmpFile(ext) {
  return path.join(os.tmpdir(), 'djousse_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) + '.' + ext);
}

function isMp3(buf) {
  if (!buf || buf.length < 3) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // ID3 tag
  return buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0; // MPEG frame sync
}

/** TTS Google françisé — vérifie que c'est un vrai MP3 (jamais une page HTML) */
async function generateTts(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!clean) return null;
  const clients = ['tw-ob', 'gtx', 'h'];
  for (let i = 0; i < clients.length; i++) {
    try {
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(clean) + '&tl=fr&client=' + clients[i];
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': UA, 'Referer': 'http://translate.google.com/' },
        timeout: 25000
      });
      const buf = Buffer.from(res.data);
      const ct = String(res.headers['content-type'] || '');
      if (isMp3(buf) || ct.includes('audio')) return buf;
    } catch (e) { /* essai suivant */ }
    if (i < clients.length - 1) await new Promise(r => setTimeout(r, 700));
  }
  return null;
}

/** Musique ambiante synthétisée (accord La mineur = La, Do, Mi) avec envolées lentes — 100% générée, aucun droit d'auteur */
function musicSrc() {
  const swell = (f, rate) => '(0.65+0.35*sin(2*PI*' + rate + '*t))*sin(2*PI*' + f + '*t)';
  return 'aevalsrc=' +
    '0.30*' + swell(220, 0.55) + '+' +      /* La2 */
    '0.24*' + swell(261.63, 0.42) + '+' +   /* Do3 */
    '0.20*' + swell(329.63, 0.31) + '+' +   /* Mi3 */
    '0.13*' + swell(440, 0.75) + '+' +      /* La3 */
    '0.10*' + swell(659.25, 0.23) + '+' +   /* Mi4 */
    '0.11*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.19*t))' +  /* basse La1 */
    ':s=24000:c=mono';                     /* somme ≈ 1.1 → -1..1 */
}

/* Musique Naruto (Ritual — Anime Kei) téléchargée dans media/ritual_bed.mp3 */
function musicRitualFile() {
  const f = path.join(__dirname, '..', 'media', 'ritual_bed.mp3');
  return fs.existsSync(f) ? f : null;
}

/* Exécution ffmpeg en brut (args) — pour -stream_loop etc. */
function runFfmpegRaw(args) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

/* TTS ElevenLabs — voix « Pain » (Adam — Dominant, Firm), français, ton grave et froid.
   Retourne un Buffer MP3, ou null si clé manquante / échec (repli Google géré par l'appelant). */
const ELEVEN_PAIN_VOICE = process.env.ELEVEN_PAIN_VOICE || 'pNInz6obpgDQGcFmaJgB';
async function ttsPain(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (!clean) return null;
  try {
    const res = await axios.post('https://api.elevenlabs.io/v1/text-to-speech/' + ELEVEN_PAIN_VOICE, {
      text: clean,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.6, use_speaker_boost: true }
    }, { headers: { 'xi-api-key': key }, responseType: 'arraybuffer', timeout: 60000 });
    const buf = Buffer.from(res.data);
    return isMp3(buf) ? buf : null;
  } catch (e) {
    const d = e.response && e.response.data;
    const msg = Buffer.isBuffer(d) ? d.toString('utf8').slice(0, 160) : (d ? JSON.stringify(d).slice(0, 160) : e.message);
    console.error('ttsPain:', e.message, msg);
    return null;
  }
}

/* Durée d'un fichier audio via ffmpeg (decode rapide, sans ffprobe) */
function getDuration(file) {
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync(ffmpegPath, ['-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
    const m = (r.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) return null;
    return (parseInt(m[1]) * 3600) + (parseInt(m[2]) * 60) + parseFloat(m[3]);
  } catch { return null; }
}

/** Convertit un MP3 en vraie note vocale OPUS/OGG (lisible sur WhatsApp mobile).
    Les notes vocales WhatsApp sont encodées OPUS : un MP3 envoyé avec ptt:true
    se lit sur le web/desktop mais échoue sur le téléphone (« audio non disponible »).
    Retourne { audio, seconds, mimetype } ou null (appelant = repli ptt:false). */
function mp3ToVoiceNote(mp3) {
  if (!mp3 || !mp3.length) return null;
  const inFile = tmpFile('mp3');
  const outFile = tmpFile('ogg');
  fs.writeFileSync(inFile, mp3);
  try {
    const { execFileSync } = require('child_process');
    execFileSync(ffmpegPath, ['-y', '-i', inFile, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-f', 'ogg', outFile], { stdio: 'ignore', timeout: 20000 });
    const seconds = Math.max(1, Math.round(getDuration(outFile) || 1));
    return { audio: fs.readFileSync(outFile), seconds, mimetype: 'audio/ogg; codecs=opus' };
  } catch (e) {
    try { fs.unlinkSync(outFile); } catch (_) {}
    return null;
  } finally {
    try { fs.unlinkSync(inFile); } catch (_) {}
  }
}

/** Mixe TTS + musique de fond → MP3 ré-encodé, musique bien audible.
 *  opts: { voice: 'google'|'pain' (défaut google), music: 'synth'|'ritual' (défaut synth) } */
async function voiceWithMusic(text, opts = {}) {
  if (!ffmpegPath) { console.warn('[voice] ffmpeg-static manquant — voiceWithMusic désactivé'); return null; }
  const voice = opts.voice === 'pain' ? 'pain' : 'google';
  const music = opts.music === 'ritual' ? 'ritual' : 'synth';
  const tts = voice === 'pain' ? (await ttsPain(text)) || await generateTts(text) : await generateTts(text);
  if (!tts) return null;
  const ttsFile = tmpFile('mp3');
  const normFile = tmpFile('norm.mp3');
  const musicFile = tmpFile('music.mp3');
  const outFile = tmpFile('mp3');
  fs.writeFileSync(ttsFile, tts);
  const run = (input, output, outputOpts) => new Promise((resolve) => {
    const cmd = ffmpeg().input(input).outputOptions(['-y'].concat(outputOpts)).save(output);
    cmd.on('end', () => resolve(true)).on('error', (e) => { console.error('ffmpeg:', e.message); resolve(false); });
  });
  try {
    /* 1) Préparer la voix (mono 24 kHz, volume voix bien présent) */
    const vok = await run(ttsFile, normFile, ['-af', 'aresample=24000,aformat=channel_layouts=mono,volume=1.5', '-ar', '24000', '-ac', '1', '-b:a', '64k']);
    if (!vok) return tts;
    const dur = getDuration(normFile) || 12;
    /* 2) Générer la piste musique (même durée que la voix) */
    let mok = false;
    const ritualFile = music === 'ritual' ? musicRitualFile() : null;
    if (ritualFile) {
      mok = await runFfmpegRaw(['-y', '-stream_loop', '-1', '-i', ritualFile, '-t', dur.toString(),
        '-af', 'aresample=24000,aformat=channel_layouts=mono,volume=0.5,afade=t=out:st=' + Math.max(0, dur - 1.5) + ':d=1.5',
        '-ar', '24000', '-ac', '1', '-b:a', '64k', musicFile]);
    } else {
      mok = await new Promise((resolve) => {
        ffmpeg()
          .input(musicSrc())
          .inputFormat('lavfi')
          .outputOptions(['-y', '-t', dur.toString(), '-af', 'aresample=24000,aformat=channel_layouts=mono,volume=0.55,tremolo=f=0.6:d=0.35,afade=t=out:st=' + Math.max(0, dur - 1.5) + ':d=1.5', '-ar', '24000', '-ac', '1', '-b:a', '64k'])
          .save(musicFile)
          .on('end', () => resolve(true))
          .on('error', (e) => { console.error('ffmpeg music:', e.message); resolve(false); });
      });
    }
    if (!mok) return tts;
    /* 3) Mix voix + musique (voix pleine, musique en fond) + limiteur + fondu final */
    const fadeSt = Math.max(0, dur - 1.2);
    const mix = await new Promise((resolve) => {
      ffmpeg()
        .input(normFile)
        .input(musicFile)
        .complexFilter([
          '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2:normalize=0,afade=t=out:st=' + fadeSt + ':d=1.2,alimiter=limit=0.95[o]'
        ], 'o')
        .outputOptions(['-ar 24000', '-ac 1', '-b:a 64k', '-y'])
        .save(outFile)
        .on('end', () => {
          try { resolve(fs.readFileSync(outFile)); } catch (e) { resolve(tts); }
        })
        .on('error', (e) => { console.error('ffmpeg mix:', e.message); resolve(tts); });
    });
    return mix;
  } finally {
    for (const f of [ttsFile, normFile, musicFile, outFile]) { try { fs.unlinkSync(f); } catch (_) {} }
  }
}

/** Envoie un texte long morcelé en plusieurs voix (chunks adaptés à la voix) */
async function voiceWithMusicChunks(text, optsOrMax = 170) {
  const opts = typeof optsOrMax === 'number' ? { max: optsOrMax } : (optsOrMax || {});
  const max = opts.max || (opts.voice === 'pain' ? 450 : 170);
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?…:\n]\s*)/).map(s => s.trim()).filter(Boolean);
  const groups = []; let cur = '';
  for (const part of parts) {
    if ((cur + ' ' + part).trim().length > max && cur) { groups.push(cur.trim()); cur = part; }
    else cur = (cur + ' ' + part).trim();
  }
  if (cur) groups.push(cur.trim());
  const audios = [];
  for (const g of groups) {
    const a = await voiceWithMusic(g, opts);
    if (a) audios.push(a);
  }
  return audios;
}

module.exports = { generateTts, ttsPain, voiceWithMusic, voiceWithMusicChunks, isMp3, musicSrc, mp3ToVoiceNote };