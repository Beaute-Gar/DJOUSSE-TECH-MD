'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — famille « édition audio/vidéo »
 * ──────────────────────────────────────────────────────────────────
 * deep · bass · reverse · slow · smooth · tempo · nightcore
 *
 * Les filtres ffmpeg sont ceux de TEDDY (plugins/mp3edit.js), repris
 * tels quels : ce sont des options ffmpeg standard, pas du code
 * propriétaire. Exécution via ffmpeg-static (déjà une dépendance DJOUSE),
 * en execFile (pas de shell → pas d'injection par le nom de fichier).
 * ══════════════════════════════════════════════════════════════════
 */
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let FFMPEG = null;
try { FFMPEG = require('ffmpeg-static'); } catch { /* optionnel */ }

/* Filtres exacts repris de TEDDY-XMD (plugins/mp3edit.js) */
const EFFETS = {
  deep: { audio: true, args: ['-af', 'atempo=4/4,asetrate=44500*2/3'], desc: 'Voix très grave (ralenti + baissé)' },
  bass: { audio: true, args: ['-af', 'equalizer=f=18:width_type=o:width=2:g=14'], desc: 'Basses amplifiées' },
  reverse: { audio: true, args: ['-filter_complex', 'areverse'], desc: 'Audio inversé' },
  slow: { audio: true, args: ['-filter:a', 'atempo=0.8,asetrate=44100'], desc: 'Ralenti' },
  smooth: { audio: false, args: ['-filter:v', "minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120'"], desc: 'Fluidité 120 fps (vidéo)' },
  tempo: { audio: true, args: ['-filter:a', 'atempo=0.9,asetrate=65100'], desc: 'Tempo ralenti' },
  nightcore: { audio: true, args: ['-filter:a', 'atempo=1.07,asetrate=44100*1.20'], desc: 'Nightcore (accéléré + aigu)' },
};

/* exécute ffmpeg sans shell ; résout le buffer de sortie */
function runFfmpeg(input, outExt, args) {
  return new Promise((resolve, reject) => {
    if (!FFMPEG) return reject(new Error('ffmpeg introuvable (dépendance ffmpeg-static absente)'));
    const out = path.join(os.tmpdir(), `djo_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${outExt}`);
    execFile(FFMPEG, ['-y', '-i', input, ...args, out], { timeout: 180000, maxBuffer: 32 * 1024 * 1024 }, (err) => {
      if (err) return reject(new Error(`ffmpeg: ${err.message.slice(0, 120)}`));
      try {
        const buf = fs.readFileSync(out);
        fs.unlinkSync(out);
        resolve(buf);
      } catch (e) { reject(e); }
    });
  });
}

function registerPortedAudio(cmd, deps) {
  const { config, mediaInfo, downloadFrom, send } = deps;

  for (const [nom, eff] of Object.entries(EFFETS)) {
    cmd(nom, {
      cat: 4,
      desc: `${eff.desc} — ${eff.audio ? 'audio' : 'vidéo'}`,
      usage: `${nom} (répondre à un ${eff.audio ? 'audio' : 'vidéo'})`,
      icon: eff.audio ? '🎵' : '🎬',
    }, async (c) => {
      const info = mediaInfo(c.msg);
      if (!info) return c.error(['RÉPONDS AU MÉDIA', `${config.prefix}${nom.toUpperCase()} (en réponse à un ${eff.audio ? 'audio' : 'vidéo'})`]);
      const isAudio = String(info.mimetype || '').startsWith('audio/');
      const isVideo = String(info.mimetype || '').startsWith('video/');
      if (eff.audio && !isAudio && !isVideo) return c.error(['AUDIO OU VIDÉO ATTENDU']);
      if (!eff.audio && !isVideo) return c.error(['VIDÉO ATTENDUE']);
      try {
        const buf = await downloadFrom(c.sock, info);
        const inExt = isVideo ? 'mp4' : 'mp3';
        const tmpIn = path.join(os.tmpdir(), `djo_in_${Date.now()}${Math.floor(Math.random() * 1e6)}.${inExt}`);
        fs.writeFileSync(tmpIn, buf);
        const out = await runFfmpeg(tmpIn, eff.audio ? 'mp3' : 'mp4', eff.args);
        fs.unlinkSync(tmpIn).catch?.(() => {});
        if (eff.audio) {
          await send(c.sock, c.from, { audio: out, mimetype: 'audio/mpeg' }, { quoted: c.msg });
        } else {
          await send(c.sock, c.from, { video: out, caption: `${eff.desc} — DJOUSSE TECH` }, { quoted: c.msg });
        }
      } catch (e) {
        return c.error([`${nom.toUpperCase()} ÉCHEC`, e.message]);
      }
    });
  }

  /* vue d'ensemble des effets */
  cmd('audiofx', { cat: 4, desc: 'Voir tous les effets audio disponibles', usage: 'audiofx', icon: '🎚️' }, async (c) => {
    const { buildFrame, bullet } = deps;
    const lines = [bullet('EFFETS', Object.keys(EFFETS).join(' · '))];
    for (const [n, e] of Object.entries(EFFETS)) lines.push(bullet(n.toUpperCase(), e.desc));
    return c.reply(buildFrame('EFFETS AUDIO/VIDÉO', lines));
  });
}

module.exports = { registerPortedAudio, EFFETS, runFfmpeg };
