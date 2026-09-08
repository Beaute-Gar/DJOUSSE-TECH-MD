const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BIN_CANDIDATES = [
  process.env.YTDLP_PATH,
  path.join(__dirname, '..', 'bin', 'yt-dlp.exe'),
  path.join(__dirname, '..', 'bin', 'yt-dlp'),
  'yt-dlp',
].filter(Boolean);

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch {}

const TMP_DIR = process.env.YTDLP_TMP_DIR || path.join(__dirname, '..', 'data', 'tmp');
const MAX_MEDIA = 90 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 300000;

function findBinary() {
  for (const c of BIN_CANDIDATES) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return 'yt-dlp';
}

function run(args, opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const bin = findBinary();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      env: { ...process.env, PATH: process.env.PATH || '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error('YTDLP_TIMEOUT'));
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(stderr.split('\n').filter(Boolean).slice(-3).join(' | ') || 'YTDLP_FAIL'));
    });
  });
}

function detectMimetype(buf) {
  if (!buf || buf.length < 12) return { type: 'unknown', mimetype: 'application/octet-stream' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { type: 'image', mimetype: 'image/png' };
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { type: 'image', mimetype: 'image/jpeg' };
  if (buf.slice(4, 8).toString() === 'ftyp') {
    const brand = buf.slice(8, 12).toString();
    if (brand === 'M4A ' || brand === 'M4B ' || brand === 'M4P ') return { type: 'audio', mimetype: 'audio/mp4' };
    return { type: 'video', mimetype: 'video/mp4' };
  }
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) return { type: 'audio', mimetype: 'audio/mpeg' };
  if (buf.slice(0, 4).toString() === 'OggS') return { type: 'audio', mimetype: 'audio/ogg' };
  if (buf.slice(0, 4).toString() === '\x1a\x45\xdf\xa3') return { type: 'video', mimetype: 'video/webm' };
  return { type: 'unknown', mimetype: 'application/octet-stream' };
}

async function download(url, opts = {}) {
  const audioOnly = !!opts.audioOnly;
  const outDir = TMP_DIR;
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const base = 'dl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const outTmpl = path.join(outDir, base + '.%(ext)s');

  const args = [
    '--no-warnings',
    '--no-playlist',
    '--max-filesize', String(MAX_MEDIA),
    '--restrict-filenames',
    '--no-mtime',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    '--extractor-args', 'youtube:player_client=web,android',
    '-o', outTmpl,
  ];
  if (audioOnly) {
    args.push('-f', 'bestaudio/best');
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
    if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  } else {
    /* Format combiné unique (déjà muxé) : évite de télécharger vidéo+audio
       séparément puis de merge avec ffmpeg — idéal sur réseau lent. */
    args.push('-f', 'b[height<=?720]/bv[height<=?720]+ba/b');
    if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  }
  args.push('--', url);

  await run(args, { timeoutMs: opts.timeoutMs });

  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
  const target = files.find(f => f.startsWith(base + '.'));
  if (!target) throw new Error('YTDLP_NO_OUTPUT');
  const filePath = path.join(outDir, target);
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_MEDIA) { try { fs.unlinkSync(filePath); } catch {} throw new Error('YTDLP_TOO_LARGE'); }
  const buf = fs.readFileSync(filePath);
  try { fs.unlinkSync(filePath); } catch {}
  const meta = detectMimetype(buf);
  return {
    ok: true,
    provider: 'yt-dlp',
    type: meta.type,
    mimetype: meta.mimetype,
    buffer: buf,
    title: '',
    url,
    platform: opts.platform,
    audioOnly,
  };
}

module.exports = { download, detectMimetype, run, findBinary };