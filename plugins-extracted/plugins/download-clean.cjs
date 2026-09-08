const { cmd } = require('../command.cjs');
const { getBuffer } = require('../lib/functions.cjs');
const dl = require('../lib/dl.cjs');

async function sendMedia(conn, m, res, caption) {
  if (!res || !res.ok) return m.reply('❌ Échec du téléchargement.\nℹ️ Lien invalide, vidéo privée ou indisponible.');
  const cap = caption ? caption : (res.title ? `📌 ${res.title}` : '');
  try {
    if (res.type === 'audio') return await conn.sendMessage(m.chat, { audio: res.buffer, mimetype: 'audio/mpeg', fileName: `${(res.title || 'audio').slice(0, 80) || 'audio'}.mp3` }, { quoted: m });
    if (res.type === 'image') return await conn.sendMessage(m.chat, { image: res.buffer, caption: cap }, { quoted: m });
    return await conn.sendMessage(m.chat, { video: res.buffer, caption: cap, mimetype: 'video/mp4' }, { quoted: m });
  } catch (e) { return m.reply('❌ Échec envoi du média.'); }
}

function linkOf(m) {
  return dl.pickUrl(m, []);
}

cmd({ pattern: 'fb', alias: ['facebook', 'fbdl', 'sd', 'hd'], desc: 'Télécharger une vidéo Facebook', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .fb <url Facebook>');
  if (!/(facebook\.com|fb\.watch|fb\.com)/.test(url)) return m.reply('❌ Ce lien n\'est pas Facebook.');
  m.reply('⬇️ Téléchargement Facebook...');
  const res = await dl.downloadFacebook(url);
  return sendMedia(conn, m, res, `⬇️ *Facebook*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'song', alias: ['play', 'mp3', 'ytmp3'], desc: 'Télécharger l\'audio d\'une vidéo YouTube (mp3)', category: 'download', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ').trim() || m.quoted?.text || '';
  if (!query) return m.reply('❌ Usage: .song <nom ou lien YouTube>');
  m.reply('⏳ Recherche du son...');
  const video = await ytResolve(query).catch(() => null);
  if (!video) return m.reply('❌ Vidéo introuvable.');
  const res = await dl.downloadYoutube(video.url, true);
  return sendMedia(conn, m, res, `🎵 ${video.title || 'Audio'}\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'ytmp4', alias: ['video', 'ytvideo', 'yt'], desc: 'Télécharger une vidéo YouTube', category: 'download', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ').trim() || m.quoted?.text || '';
  if (!query) return m.reply('❌ Usage: .ytmp4 <nom ou lien YouTube>');
  m.reply('⏳ Recherche de la vidéo...');
  const video = await ytResolve(query).catch(() => null);
  if (!video) return m.reply('❌ Vidéo introuvable.');
  const res = await dl.downloadYoutube(video.url, false);
  return sendMedia(conn, m, res, `🎬 ${video.title || 'Video'}\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'spotify', desc: 'Télécharger un son depuis un lien Spotify', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .spotify <url spotify>');
  if (!/open\.spotify\.com/.test(url)) return m.reply('❌ Ce lien n\'est pas Spotify.');
  m.reply('⬇️ Téléchargement Spotify...');
  const res = await dl.downloadSpotify(url);
  return sendMedia(conn, m, res, `🎵 *Spotify*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'pinterest', alias: ['pindl'], desc: 'Télécharger une image/vidéo Pinterest', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .pinterest <url pinterest>');
  if (!/pinterest\./.test(url)) return m.reply('❌ Ce lien n\'est pas Pinterest.');
  m.reply('⬇️ Téléchargement Pinterest...');
  const res = await dl.downloadPinterest(url);
  return sendMedia(conn, m, res, `📌 *Pinterest*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'mediafire', alias: ['mfire'], desc: 'Télécharger un fichier Mediafire', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .mediafire <url mediafire>');
  if (!/mediafire\.com/.test(url)) return m.reply('❌ Ce lien n\'est pas Mediafire.');
  m.reply('⬇️ Téléchargement Mediafire...');
  const res = await dl.downloadMediafire(url);
  return sendMedia(conn, m, res, `📦 *Mediafire*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'twitter', alias: ['twdl', 'xdl', 'twt'], desc: 'Télécharger une vidéo/image Twitter/X', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .twitter <url twitter/x>');
  if (!/(twitter\.com|x\.com|t\.co)/.test(url)) return m.reply('❌ Ce lien n\'est pas Twitter/X.');
  m.reply('⬇️ Téléchargement Twitter...');
  const res = await dl.downloadTwitter(url);
  return sendMedia(conn, m, res, `🐦 *Twitter/X*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'gdrive', alias: ['gdrive2'], desc: 'Télécharger un fichier Google Drive', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .gdrive <url google drive>');
  if (!/drive\.google\.com/.test(url)) return m.reply('❌ Ce lien n\'est pas Google Drive.');
  m.reply('⬇️ Téléchargement Google Drive...');
  const res = await dl.downloadGdrive(url);
  return sendMedia(conn, m, res, `📁 *Google Drive*\n\n© DJOUSSE TECH`);
});

cmd({ pattern: 'direct', desc: 'Télécharger un fichier via lien direct', category: 'download', filename: __filename }, async (conn, m) => {
  const url = linkOf(m);
  if (!url) return m.reply('❌ Usage: .direct <url directe>');
  m.reply('⬇️ Téléchargement direct...');
  try {
    const buf = await getBuffer(url);
    if (!buf || !buf.length) return m.reply('❌ Fichier vide ou inaccessible.');
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'fichier';
    return await conn.sendMessage(m.chat, { document: buf, mimetype: 'application/octet-stream', fileName: name }, { quoted: m });
  } catch (e) { return m.reply('❌ Échec du téléchargement direct.'); }
});

async function ytResolve(query) {
  const m = String(query).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return { url: 'https://www.youtube.com/watch?v=' + m[1], title: 'YouTube' };
  const yts = require('yt-search');
  const r = await yts(query);
  return r.videos?.[0] ? { url: r.videos[0].url, title: r.videos[0].title } : null;
}