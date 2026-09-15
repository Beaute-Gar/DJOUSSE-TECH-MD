const https = require('https');
const http = require('http');

function pickUrl(m, args) {
  const body = (m.body || m.text || '').trim();
  const urlMatch = body.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : (args && args[0] ? args[0] : null);
}

function fetchJSON(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

function fetchBuffer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return fetchBuffer(res.headers.location, timeout).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

async function downloadFacebook(url) {
  try {
    const api = `https://api.vevioz.com/api/button/mp4?url=${encodeURIComponent(url)}`;
    const data = await fetchJSON(api);
    if (data && data.length > 0) {
      const best = data.find(d => d.quality === 'HD') || data[0];
      const buffer = await fetchBuffer(best.url);
      return { ok: true, buffer, title: best.title || 'Facebook Video', type: 'video' };
    }
    return { ok: false, error: 'No download found' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function downloadYoutube(url, audioOnly = false) {
  try {
    const ytdl = require('@distube/ytdl-core');
    const info = await ytdl.getInfo(url);
    const format = audioOnly
      ? ytdl.chooseFormat(info.formats, { quality: 'highestaudio' })
      : ytdl.chooseFormat(info.formats, { quality: '18' });
    const buffer = await ytdl.downloadFromInfo(info, { format });
    return { ok: true, buffer, title: info.videoDetails.title, type: audioOnly ? 'audio' : 'video' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function downloadInstagram(url) {
  try {
    const api = `https://api.vevioz.com/api/button/mp4?url=${encodeURIComponent(url)}`;
    const data = await fetchJSON(api);
    if (data && data.length > 0) {
      const buffer = await fetchBuffer(data[0].url);
      return { ok: true, buffer, title: data[0].title || 'Instagram', type: 'video' };
    }
    return { ok: false, error: 'No download found' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function downloadTiktok(url) {
  try {
    const api = `https://api.vevioz.com/api/button/mp4?url=${encodeURIComponent(url)}`;
    const data = await fetchJSON(api);
    if (data && data.length > 0) {
      const noWm = data.find(d => d.quality === 'No Watermark') || data[0];
      const buffer = await fetchBuffer(noWm.url);
      return { ok: true, buffer, title: noWm.title || 'TikTok', type: 'video' };
    }
    return { ok: false, error: 'No download found' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function downloadSpotify(url) { return { ok: false, error: 'Spotify download not available' }; }
async function downloadPinterest(url) { return { ok: false, error: 'Pinterest download not available' }; }
async function downloadMediafire(url) { return { ok: false, error: 'Mediafire download not available' }; }
async function downloadTwitter(url) { return downloadFacebook(url); }
async function downloadGdrive(url) { return { ok: false, error: 'GDrive download not available' }; }
async function downloadSoundcloud(url) { return { ok: false, error: 'Soundcloud download not available' }; }
async function downloadThreads(url) { return downloadInstagram(url); }
async function downloadDouyin(url) { return downloadTiktok(url); }

module.exports = {
  pickUrl, fetchJSON, fetchBuffer,
  downloadFacebook, downloadYoutube, downloadInstagram, downloadTiktok,
  downloadSpotify, downloadPinterest, downloadMediafire, downloadTwitter,
  downloadGdrive, downloadSoundcloud, downloadThreads, downloadDouyin,
};
