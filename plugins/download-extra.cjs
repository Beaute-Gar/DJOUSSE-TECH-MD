const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');
const yts = require('yt-search');
const dl = require('../lib/dl.cjs');

async function ytResolve(query) {
  const m = String(query).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return { url: 'https://www.youtube.com/watch?v=' + m[1], title: 'YouTube' };
  const r = await yts(query);
  return r.videos?.[0] ? { url: r.videos[0].url, title: r.videos[0].title } : null;
}

async function downloadAndSend(conn, m, res, opts) {
  if (!res || !res.ok) return m.reply('❌ ' + (opts.failText || 'Échec du téléchargement.'));
  const caption = res.title ? `📌 ${res.title}` : (opts.caption || '');
  try {
    if (res.type === 'audio') return await conn.sendMessage(m.chat, { audio: res.buffer, mimetype: 'audio/mpeg', fileName: `${res.title || 'audio'}.mp3` }, { quoted: m });
    if (res.type === 'image') return await conn.sendMessage(m.chat, { image: res.buffer, caption }, { quoted: m });
    return await conn.sendMessage(m.chat, { video: res.buffer, caption, mimetype: 'video/mp4' }, { quoted: m });
  } catch (e) { return m.reply('❌ Échec envoi du média.'); }
}

cmd({ pattern: 'ytdl', desc: 'Télécharger la vidéo YouTube', category: 'download', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ').trim() || m.quoted?.text || '';
  if (!query) return m.reply('❌ Usage: .ytdl <nom ou lien YouTube>');
  m.reply('⏳ *Téléchargement de la vidéo...*');
  const video = await ytResolve(query).catch(() => null);
  if (!video) return m.reply('❌ Vidéo introuvable.');
  const res = await dl.downloadYoutube(video.url, false);
  if (!res.ok) return m.reply('❌ Téléchargement YouTube impossible (aucun provider fiable).\nℹ️ Essaie .yts pour rechercher une vidéo.');
  return downloadAndSend(conn, m, res, { caption: '🎬 ' + (video.title || 'Video') });
});

cmd({ pattern: 'ytaudio', desc: 'Télécharger l\'audio YouTube (mp3)', category: 'download', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ').trim() || m.quoted?.text || '';
  if (!query) return m.reply('❌ Usage: .ytaudio <nom ou lien YouTube>');
  m.reply('⏳ *Recherche et téléchargement de l\'audio...*');
  const video = await ytResolve(query).catch(() => null);
  if (!video) return m.reply('❌ Vidéo introuvable.');
  const res = await dl.downloadYoutube(video.url, true);
  if (!res.ok) return m.reply('❌ Téléchargement YouTube impossible (aucun provider fiable).\nℹ️ Essaie .yts pour rechercher une vidéo.');
  return downloadAndSend(conn, m, res, {});
});

cmd({ pattern: 'douyin', desc: 'Télécharger une vidéo Douyin/TikTok chinois', category: 'download', filename: __filename }, async (conn, m) => {
  const url = m.body.split(' ')[1] || m.quoted?.text || '';
  if (!url) return m.reply('❌ Usage: .douyin <url douyin>');
  m.reply('⏳ *Téléchargement...*');
  const res = await dl.downloadDouyin(url);
  return downloadAndSend(conn, m, res, { failText: '❌ Échec du téléchargement Douyin.', caption: '🎬 *Douyin Video*' });
});

cmd({ pattern: 'threads', desc: 'Télécharger une vidéo Threads', category: 'download', filename: __filename }, async (conn, m) => {
  const url = m.body.split(' ')[1] || m.quoted?.text || '';
  if (!url) return m.reply('❌ Usage: .threads <url threads>');
  m.reply('⏳ *Téléchargement...*');
  const res = await dl.downloadThreads(url);
  return downloadAndSend(conn, m, res, { failText: '❌ Échec du téléchargement Threads.', caption: '🎬 *Threads Video*' });
});

cmd({ pattern: 'soundcloud', desc: 'Télécharger un son SoundCloud', category: 'download', filename: __filename }, async (conn, m) => {
  const url = m.body.split(' ')[1] || m.quoted?.text || '';
  if (!url) return m.reply('❌ Usage: .soundcloud <url soundcloud>');
  m.reply('⏳ *Téléchargement...*');
  const res = await dl.downloadSoundcloud(url);
  if (!res.ok) return m.reply('❌ Son introuvable.');
  return downloadAndSend(conn, m, res, {});
});

cmd({ pattern: 'ringtone', desc: 'Télécharger une sonnerie', category: 'download', filename: __filename }, async (conn, m) => {
  const query = m.body.split(' ').slice(1).join(' ');
  if (!query) return m.reply('❌ Usage: .ringtone <nom de sonnerie>');
  m.reply('⏳ *Recherche de sonnerie...*');
  try {
    const data = await fetchJson(`https://g4xxvapi2.moopa.workers.dev/ringtone?q=${encodeURIComponent(query)}`);
    const list = data?.data || data?.result || [];
    const ring = list[0];
    const audioUrl = ring?.url || ring?.audio;
    if (!audioUrl) return m.reply('❌ Sonnerie introuvable.');
    const audio = await getBuffer(audioUrl);
    if (!audio) return m.reply('❌ Téléchargement échoué.');
    await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg', fileName: `${ring?.title || query}.mp3` }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'web2zip', desc: 'Télécharger le contenu d\'un site en zip', category: 'download', filename: __filename }, async (conn, m) => {
  const url = m.body.split(' ')[1];
  if (!url) return m.reply('❌ Usage: .web2zip <url>');
  m.reply('⏳ *Téléchargement du site...*');
  try {
    const data = await fetchJson(`https://g4xxvapi2.moopa.workers.dev/web2zip?url=${encodeURIComponent(url)}`);
    const zipUrl = data?.data?.zip || data?.zip || data?.url;
    if (!zipUrl) return m.reply('❌ Fichier zip introuvable.');
    const doc = await getBuffer(zipUrl);
    if (!doc) return m.reply('❌ Téléchargement échoué.');
    await conn.sendMessage(m.chat, { document: doc, mimetype: 'application/zip', fileName: 'website.zip' }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});