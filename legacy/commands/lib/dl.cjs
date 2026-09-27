const https = require('https');
const http = require('http');
const axios = require('axios');

function pickUrl(m, args) {
  const body = (m.body || m.text || '').trim();
  const urlMatch = body.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : (args && args[0] ? args[0] : null);
}

function fetchJSON(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('URL invalide'));
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

function fetchBuffer(url, timeout = 60000) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('URL invalide'));
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return fetchBuffer(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

// ==================== YOUTUBE ====================
async function downloadYoutube(url, audioOnly = false) {
  // Méthode 1: @distube/ytdl-core
  try {
    const ytdl = require('@distube/ytdl-core');
    const info = await ytdl.getInfo(url);
    const format = audioOnly
      ? ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' })
      : ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
    const buffer = await ytdl.downloadFromInfo(info, { format });
    return { ok: true, buffer, title: info.videoDetails.title, type: audioOnly ? 'audio' : 'video' };
  } catch (e1) {
    console.log('[YT] @distube/ytdl-core failed:', e1.message);
  }

  // Méthode 2: ytdl-core
  try {
    const ytdl = require('ytdl-core');
    const info = await ytdl.getInfo(url);
    const format = audioOnly
      ? ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' })
      : ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
    const buffer = await ytdl.downloadFromInfo(info, { format });
    return { ok: true, buffer, title: info.videoDetails.title, type: audioOnly ? 'audio' : 'video' };
  } catch (e2) {
    console.log('[YT] ytdl-core failed:', e2.message);
  }

  return { ok: false, error: 'Téléchargement YouTube indisponible. Réessayez plus tard.' };
}

// ==================== TIKTOK (FIXÉ) ====================
async function downloadTiktok(url) {
  // Méthode 1: ruhend-scraper (retourne video_hd directement)
  try {
    const { ttdl } = require('ruhend-scraper');
    const result = await ttdl(url);
    if (result) {
      const videoUrl = result.video_hd || result.video || result.video_wm;
      if (videoUrl) {
        const buffer = await fetchBuffer(videoUrl);
        return { ok: true, buffer, title: result.title || 'TikTok', type: 'video' };
      }
    }
  } catch (e1) {
    console.log('[TT] ruhend-scraper failed:', e1.message);
  }

  // Méthode 2: tikwm API
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', {
      url: url, count: 12, cursor: 0, web: 1, hd: 1
    }, { timeout: 30000 });
    if (data?.code === 0 && data?.data) {
      const videoUrl = data.data.hdplay || data.data.play;
      if (videoUrl) {
        const buffer = await fetchBuffer(videoUrl);
        return { ok: true, buffer, title: data.data.title || 'TikTok', type: 'video' };
      }
    }
  } catch (e2) {
    console.log('[TT] tikwm failed:', e2.message);
  }

  return { ok: false, error: 'Téléchargement TikTok indisponible. Vérifiez l\'URL.' };
}

// ==================== FACEBOOK ====================
async function downloadFacebook(url) {
  // Méthode 1: @bochilteam/scraper-facebook
  try {
    const { facebookdl } = require('@bochilteam/scraper-facebook');
    const data = await facebookdl(url);
    if (data?.video?.length > 0) {
      const videoData = await data.video[0].download();
      let buffer;
      if (Buffer.isBuffer(videoData)) buffer = videoData;
      else if (videoData?.url) buffer = await fetchBuffer(videoData.url);
      else if (typeof videoData === 'string') buffer = await fetchBuffer(videoData);
      if (buffer?.length > 0) {
        return { ok: true, buffer, title: 'Facebook Video', type: 'video' };
      }
    }
  } catch (e1) {
    console.log('[FB] @bochilteam failed:', e1.message);
  }

  // Méthode 2: tikwm (supporte FB)
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 30000 });
    if (data?.code === 0 && data?.data?.play) {
      const buffer = await fetchBuffer(data.data.play);
      return { ok: true, buffer, title: data.data.title || 'Facebook Video', type: 'video' };
    }
  } catch (e2) {
    console.log('[FB] tikwm failed:', e2.message);
  }

  return { ok: false, error: 'Téléchargement Facebook indisponible. Vérifiez l\'URL ou essayez un lien public.' };
}

// ==================== INSTAGRAM ====================
async function downloadInstagram(url) {
  // Méthode 1: ruhend-scraper igdl
  try {
    const { igdl } = require('ruhend-scraper');
    const result = await igdl(url);
    if (result?.data?.length > 0) {
      const media = result.data[0];
      const buffer = await fetchBuffer(media.url);
      return { ok: true, buffer, title: 'Instagram', type: media.type === 'video' ? 'video' : 'image' };
    }
    // Fallback: certaines versions retournent url/media directement
    if (result?.url) {
      const buffer = await fetchBuffer(result.url);
      return { ok: true, buffer, title: 'Instagram', type: result.type === 'video' ? 'video' : 'image' };
    }
  } catch (e1) {
    console.log('[IG] ruhend-scraper failed:', e1.message);
  }

  // Méthode 2: tikwm (supporte IG)
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 30000 });
    if (data?.code === 0 && data?.data?.play) {
      const buffer = await fetchBuffer(data.data.play);
      return { ok: true, buffer, title: data.data.title || 'Instagram', type: 'video' };
    }
  } catch (e2) {
    console.log('[IG] tikwm failed:', e2.message);
  }

  return { ok: false, error: 'Téléchargement Instagram indisponible. Vérifiez que le post est public.' };
}

// ==================== TWITTER/X ====================
async function downloadTwitter(url) {
  // Méthode 1: tikwm (supporte Twitter/X)
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 30000 });
    if (data?.code === 0 && data?.data?.play) {
      const buffer = await fetchBuffer(data.data.play);
      return { ok: true, buffer, title: data.data.title || 'Twitter/X', type: 'video' };
    }
  } catch (e1) {
    console.log('[TW] tikwm failed:', e1.message);
  }

  return { ok: false, error: 'Téléchargement Twitter/X indisponible. Vérifiez l\'URL.' };
}

// ==================== PINTEREST ====================
async function downloadPinterest(url) {
  // Méthode 1: tikwm (supporte Pinterest)
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 30000 });
    if (data?.code === 0 && data?.data?.play) {
      const buffer = await fetchBuffer(data.data.play);
      return { ok: true, buffer, title: data.data.title || 'Pinterest', type: 'video' };
    }
    if (data?.code === 0 && data?.data?.cover) {
      const buffer = await fetchBuffer(data.data.cover);
      return { ok: true, buffer, title: data.data.title || 'Pinterest', type: 'image' };
    }
  } catch (e1) {
    console.log('[PIN] tikwm failed:', e1.message);
  }

  return { ok: false, error: 'Téléchargement Pinterest indisponible.' };
}

// ==================== LYRICS (lrclib.net) ====================
async function searchLyrics(query) {
  try {
    const { data } = await axios.get(`https://lrclib.net/api/search?track_name=${encodeURIComponent(query)}`, {
      timeout: 15000, headers: { 'User-Agent': 'DJOUSSE-TECH-MD-Bot/1.0' }
    });
    if (data?.length > 0) {
      const song = data[0];
      return {
        ok: true,
        title: song.trackName,
        artist: song.artistName,
        album: song.albumName,
        duration: song.duration,
        lyrics: song.syncedLyrics || song.plainLyrics || 'Paroles non disponibles',
        hasSynced: !!song.syncedLyrics
      };
    }
    return { ok: false, error: 'Aucune chanson trouvée pour cette recherche.' };
  } catch (e) {
    console.log('[LYRICS] lrclib failed:', e.message);
    return { ok: false, error: 'Recherche de paroles indisponible.' };
  }
}

// ==================== MEDIAFIRE ====================
async function downloadMediafire(url) {
  return { ok: false, error: 'Téléchargement Mediafire non disponible.' };
}

// ==================== GDRIVE ====================
async function downloadGdrive(url) {
  return { ok: false, error: 'Téléchargement Google Drive non disponible.' };
}

// ==================== SPOTIFY ====================
async function downloadSpotify(url) {
  return { ok: false, error: 'Téléchargement Spotify non disponible.' };
}

// ==================== SOUNDCLOUD ====================
async function downloadSoundcloud(url) {
  return { ok: false, error: 'Téléchargement Soundcloud non disponible.' };
}

// ==================== ALIASES ====================
async function downloadThreads(url) { return downloadInstagram(url); }
async function downloadDouyin(url) { return downloadTiktok(url); }

module.exports = {
  pickUrl, fetchJSON, fetchBuffer,
  downloadFacebook, downloadYoutube, downloadInstagram, downloadTiktok,
  downloadTwitter, downloadPinterest, downloadMediafire, downloadGdrive,
  downloadSpotify, downloadSoundcloud, downloadThreads, downloadDouyin,
  searchLyrics,
};
