const { getBuffer } = require('./functions.cjs');
const { withTimeout } = require('./withTimeout.cjs');

let ytdlp = null;
try { ytdlp = require('./ytdlp.cjs'); } catch { }

let ruhend = null;
let mrnima = null;
let xaviabot = null;
let yts = null;
try { ruhend = require('ruhend-scraper'); } catch { }
try { mrnima = require('@mrnima/facebook-downloader'); } catch { }
try { xaviabot = require('@xaviabot/fb-downloader'); } catch { }
try { yts = require('yt-search'); } catch { }
let pzx = null;
try { pzx = require('./prexzy.cjs'); } catch { }

const TIMEOUT_MS = 20000;
const MAX_MEDIA = 90 * 1024 * 1024;

function detectMimetype(buf) {
  if (!buf || buf.length < 12) return { type: 'unknown', mimetype: 'application/octet-stream' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { type: 'image', mimetype: 'image/png' };
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { type: 'image', mimetype: 'image/jpeg' };
  if (buf.slice(0, 6).toString() === 'GIF89a' || buf.slice(0, 6).toString() === 'GIF87a') return { type: 'image', mimetype: 'image/gif' };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { type: 'image', mimetype: 'image/webp' };
  if (buf.slice(4, 8).toString() === 'ftyp') {
    const brand = buf.slice(8, 12).toString();
    if (brand === 'M4A ' || brand === 'M4B ' || brand === 'M4P ') return { type: 'audio', mimetype: 'audio/mp4' };
    return { type: 'video', mimetype: 'video/mp4' };
  }
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) return { type: 'audio', mimetype: 'audio/mpeg' };
  if (buf.slice(0, 4).toString() === 'OggS') return { type: 'audio', mimetype: 'audio/ogg' };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE') return { type: 'audio', mimetype: 'audio/wav' };
  if (buf.slice(0, 4).toString() === '\x1a\x45\xdf\xa3') return { type: 'video', mimetype: 'video/webm' };
  return { type: 'unknown', mimetype: 'application/octet-stream' };
}

function safe(run, label, timeoutMs) {
  try {
    const value = withTimeout(Promise.resolve().then(run), timeoutMs || TIMEOUT_MS, label);
    return Promise.resolve(value).then(
      v => ({ ok: true, value: v }),
      e => ({ ok: false, error: e && e.message ? e.message : String(e) })
    );
  } catch (e) {
    return Promise.resolve({ ok: false, error: e && e.message ? e.message : String(e) });
  }
}

function detectPlatform(url) {
  const u = String(url || '').toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/(instagram\.com|instagr\.am)/.test(u)) return 'instagram';
  if (/(facebook\.com|fb\.watch|fb\.com)/.test(u)) return 'facebook';
  if (/(twitter\.com|x\.com|t\.co)/.test(u)) return 'twitter';
  if (/soundcloud\.com/.test(u)) return 'soundcloud';
  if (/open\.spotify\.com/.test(u)) return 'spotify';
  if (/pinterest\./.test(u)) return 'pinterest';
  if (/mediafire\.com/.test(u)) return 'mediafire';
  if (/drive\.google\.com/.test(u)) return 'gdrive';
  if (/douyin\.com/.test(u)) return 'douyin';
  if (/threads\.net/.test(u)) return 'threads';
  return 'unknown';
}

function youtubeId(url) {
  const m = String(url).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function kindOf(key) {
  const k = String(key || '').toLowerCase();
  if (/audio|mp3|music/.test(k)) return 'audio';
  if (/image|img|thumb|cover|avatar|photo|picture/.test(k)) return 'image';
  if (/video|dl|download|hd|sd|wm|play|stream/.test(k)) return 'video';
  return '';
}

function rankOf(key, type) {
  const k = String(key || '').toLowerCase();
  if (type === 'video') {
    if (/hd|no_wm|watermark.{0,3}0|clean/.test(k)) return 4;
    if (/wm|watermark/.test(k)) return 2;
    return 3;
  }
  return 1;
}

function extractMediaUrls(result, rejectHosts) {
  const out = [];
  const seen = new Set();
  const push = (url, key) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    if (rejectHosts && rejectHosts.some(h => host.includes(h))) return;
    if (seen.has(url)) return;
    seen.add(url);
    let type = kindOf(key);
    if (!type) {
      if (/\.(mp3|m4a|ogg|wav|flac)/.test(url.toLowerCase())) type = 'audio';
      else if (/\.(jpe?g|png|webp|gif|bmp)/.test(url.toLowerCase())) type = 'image';
      else type = 'video';
    }
    out.push({ url, type, rank: rankOf(key, type) });
  };
  if (!result) return out;
  if (typeof result === 'string') push(result, '');
  else if (Array.isArray(result)) {
    for (const item of result) {
      if (typeof item === 'string') push(item, '');
      else if (item && typeof item === 'object') {
        push(item.url, ''); push(item.video || item.videoUrl || item.downloadUrl, 'video');
        push(item.image || item.thumbnail || item.preview, 'image'); push(item.audio || item.mp3, 'audio');
      }
    }
  } else if (typeof result === 'object') {
    for (const key of Object.keys(result)) {
      const v = result[key];
      if (typeof v === 'string') push(v, key);
      else if (Array.isArray(v)) for (const x of v) push(typeof x === 'string' ? x : (x && x.url), key);
    }
  }
  out.sort((a, b) => b.rank - a.rank);
  return out;
}

async function runChain(url, tries, opts) {
  const accept = opts.accept || ['video', 'image', 'audio'];
  for (const [name, run] of tries) {
    if (!run) continue;
    /* yt-dlp télécharge réellement le média → timeout généreux (180s) ;
       les scrapers renvoient des URLs → 20s suffisent. */
    const timeoutMs = name === 'yt-dlp' ? 180000 : TIMEOUT_MS;
    const r = await safe(run, name, timeoutMs);
    if (!r.ok) continue;
    /* Fournisseur de type yt-dlp : renvoie directement le buffer déjà téléchargé
       (pas une liste d'URLs). On le consomme tel quel. */
    const rv = r.value;
    if (rv && rv.buffer && Buffer.isBuffer(rv.buffer) && rv.buffer.length && accept.includes(rv.type)) {
      if (rv.buffer.length > MAX_MEDIA) continue;
      return { ok: true, provider: name, type: rv.type, buffer: rv.buffer, title: String(rv.title || '').slice(0, 200), platform: opts.platform, url: rv.url };
    }
    const body = rv && typeof rv === 'object' && rv.data && !Array.isArray(rv) ? rv.data : rv;
    let media = extractMediaUrls(body, opts.rejectHosts);
    if (!media.length) media = extractMediaUrls(rv, opts.rejectHosts);
    if (!media.length) continue;
    const item = media.find(x => accept.includes(x.type)) || null;
    if (!item) continue;
    const buf = await safe(() => getBuffer(item.url), 'buffer');
    if (!buf.ok || !buf.value || !buf.value.length || buf.value.length > MAX_MEDIA) continue;
    let title = '';
    if (rv && typeof rv === 'object') {
      title = String(rv.title || rv.desc || rv.region || rv.author || '').slice(0, 200);
    }
    return { ok: true, provider: name, type: item.type, buffer: buf.value, title, platform: opts.platform, url: item.url };
  }
  return { ok: false, error: 'ALL_PROVIDERS_FAILED', platform: opts.platform };
}

function aioRun() {
  return (url) => (pzx && typeof pzx.aioDownload === 'function' ? pzx.aioDownload(url) : null);
}

function ytsearchRun() {
  if (!ruhend || typeof ruhend.ytsearch !== 'function') return null;
  return async (url) => {
    const id = youtubeId(url) || String(url);
    const out = await ruhend.ytsearch(id);
    const list = out && (out.video || out.videos) || [];
    const v = list[0];
    return v ? v.url : null;
  };
}

async function youtubeThumbFallback(url) {
  if (!yts) return null;
  try {
    const term = youtubeId(url) || String(url);
    const out = await withTimeout(Promise.resolve(yts(term)), TIMEOUT_MS, 'ytthumb');
    const v = out && out.videos && out.videos[0];
    if (!v || !v.thumbnail) return null;
    const buf = await safe(() => getBuffer(v.thumbnail), 'ytthumb-buf');
    if (!buf.ok || !buf.value || !buf.value.length || buf.value.length > MAX_MEDIA) return null;
    const views = v.views ? v.views.toLocaleString('fr-FR') + ' vues' : '';
    const caption = ['🖼️ ' + (v.title || 'YouTube'), views ? '👀 ' + views : '', v.timestamp ? '⏱️ ' + v.timestamp : '', '🔗 ' + (v.url || url)].filter(Boolean).join('\n');
    return { ok: true, provider: 'yt-thumb', type: 'image', buffer: buf.value, title: caption, platform: 'youtube', fallback: true, url: v.url || url };
  } catch { return null; }
}

function ytdlpRun(url, audioOnly) {
  return () => {
    if (!ytdlp || typeof ytdlp.download !== 'function') return Promise.resolve(null);
    return ytdlp.download(url, { audioOnly, platform: 'ytdlp' }).then(r => r.ok ? r : null);
  };
}

async function downloadTiktok(url) {
  const tries = [
    ['yt-dlp', ytdlpRun(url)],
    ['ruhend.ttdl', ruhend && typeof ruhend.ttdl === 'function' ? () => ruhend.ttdl(url) : null],
    ['prexzy.aio', aioRun()],
  ];
  return runChain(url, tries, { accept: ['video'], platform: 'tiktok' });
}

async function downloadInstagram(url) {
  const tries = [
    ['yt-dlp', ytdlpRun(url)],
    ['ruhend.igdl', ruhend && typeof ruhend.igdl === 'function' ? () => ruhend.igdl(url) : null],
    ['ruhend.igdl2', ruhend && typeof ruhend.igdl2 === 'function' ? () => ruhend.igdl2(url) : null],
    ['prexzy.aio', aioRun()],
  ];
  return runChain(url, tries, { accept: ['video', 'image'], platform: 'instagram' });
}

async function downloadFacebook(url) {
  const tryModule = (mod, methods) => {
    if (!mod) return null;
    return () => {
      for (const m of methods) {
        if (typeof mod[m] === 'function') return mod[m](url);
      }
      return null;
    };
  };
  const tries = [
    ['yt-dlp', ytdlpRun(url)],
    ['ruhend.fbdl', ruhend && typeof ruhend.fbdl === 'function' ? () => ruhend.fbdl(url) : null],
    ['ruhend.fbdl2', ruhend && typeof ruhend.fbdl2 === 'function' ? () => ruhend.fbdl2(url) : null],
    ['mrnima-fb', tryModule(mrnima, ['fbdl', 'download', 'getVideo', 'facebook'])],
    ['xaviabot-fb', tryModule(xaviabot, ['fbdl', 'download', 'getVideo', 'facebook'])],
  ];
  return runChain(url, tries, { accept: ['video'], platform: 'facebook' });
}

async function downloadYoutube(url, audioOnly) {
  const accept = audioOnly ? ['audio'] : ['video', 'audio'];
  const tries = [
    ['yt-dlp', ytdlpRun(url, audioOnly)],
    ['ruhend.ytsearch', ytsearchRun()],
    ['prexzy.aio', aioRun()],
  ];
  const res = await runChain(url, tries, { accept, rejectHosts: ['youtube.com', 'youtu.be'], platform: 'youtube' });
  if (res.ok) return res;
  const fb = await youtubeThumbFallback(url);
  if (fb) return fb;
  return res;
}

async function downloadTwitter(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url)], ['prexzy.aio', aioRun()]], { accept: ['video', 'image'], platform: 'twitter' });
}

async function downloadSoundcloud(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url, true)], ['prexzy.aio', aioRun()]], { accept: ['audio'], platform: 'soundcloud' });
}

async function downloadSpotify(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url, true)], ['prexzy.aio', aioRun()]], { accept: ['audio'], platform: 'spotify' });
}

async function downloadPinterest(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url)], ['prexzy.aio', aioRun()]], { accept: ['image', 'video'], platform: 'pinterest' });
}

async function downloadMediafire(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url)], ['prexzy.aio', aioRun()]], { accept: ['video', 'audio', 'image'], platform: 'mediafire' });
}

async function downloadGdrive(url) {
  let direct = String(url);
  const idMatch = String(url).match(/\/file\/d\/([\w-]+)/) || String(url).match(/[?&]id=([\w-]+)/);
  if (idMatch) direct = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  if (/drive\.google\.com\/uc\?/.test(String(url))) direct = url;
  return runChain(url, [
    ['direct-uc', () => direct],
    ['yt-dlp', ytdlpRun(url)],
    ['prexzy.aio', aioRun()],
  ], { accept: ['video', 'audio', 'image'], platform: 'gdrive' });
}

async function downloadDouyin(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url)], ['prexzy.aio', aioRun()]], { accept: ['video', 'image'], platform: 'douyin' });
}

async function downloadThreads(url) {
  return runChain(url, [['yt-dlp', ytdlpRun(url)], ['prexzy.aio', aioRun()]], { accept: ['video', 'image'], platform: 'threads' });
}

const DISPATCH = {
  youtube: (u) => downloadYoutube(u, false),
  tiktok: downloadTiktok,
  instagram: downloadInstagram,
  facebook: downloadFacebook,
  twitter: downloadTwitter,
  soundcloud: downloadSoundcloud,
  spotify: downloadSpotify,
  pinterest: downloadPinterest,
  mediafire: downloadMediafire,
  gdrive: downloadGdrive,
  douyin: downloadDouyin,
  threads: downloadThreads,
};

async function downloadPlatform(url, audioOnly) {
  const platform = detectPlatform(url);
  const fn = DISPATCH[platform];
  if (!fn) return { ok: false, error: 'PLATFORM_UNSUPPORTED', platform };
  const t0 = Date.now();
  const res = await fn(url, audioOnly);
  res.durationMs = Date.now() - t0;
  return res;
}

function pickUrl(m, args) {
  const inline = Array.isArray(args) && args.find(a => /^https?:\/\//i.test(a));
  if (inline) return inline;
  const body = m && (m.body || m.text || '');
  if (body) {
    const match = body.match(/(https?:\/\/\S+)/i);
    if (match) return match[1];
  }
  const q = m && m.quoted && (m.quoted.text || m.quoted.body || '');
  if (q) {
    const qMatch = q.match(/(https?:\/\/\S+)/i);
    if (qMatch) return qMatch[1];
  }
  return null;
}

module.exports = {
  detectPlatform,
  downloadPlatform,
  downloadYoutube,
  downloadTiktok,
  downloadInstagram,
  downloadFacebook,
  downloadTwitter,
  downloadSoundcloud,
  downloadSpotify,
  downloadPinterest,
  downloadMediafire,
  downloadGdrive,
  downloadDouyin,
  downloadThreads,
  extractMediaUrls,
  detectMimetype,
  pickUrl,
};