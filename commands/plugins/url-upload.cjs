const { cmd } = require('../command.cjs');
const fetch = require('node-fetch');
const FormData = require('form-data');

async function uploadMedia(buffer, ext, mime) {
  const form = new FormData();
  form.append('upload', buffer, { filename: 'file.' + ext, contentType: mime });
  form.append('numfiles', '1'); form.append('expiration', '0'); form.append('type', 'file');
  const res = await fetch('https://postimages.org/json/rr', { method: 'POST', body: form, headers: { origin: 'https://postimages.org', referer: 'https://postimages.org/' } });
  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  const json = await res.json();
  if (!json?.url) throw new Error('Upload sans URL');
  return json.url;
}

cmd({
  pattern: 'url',
  alias: ['geturl', 'u'],
  react: '🔗',
  desc: 'Uploader un média et obtenir une URL',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (!m.quoted || !['imageMessage', 'videoMessage', 'audioMessage'].includes(m.quoted.mtype)) return reply('❌ Réponds à un média avec .url');
  try {
    await m.react('⏳').catch(() => {});
    const media = await m.quoted.download();
    const ext = m.quoted.mtype === 'imageMessage' ? 'jpg' : m.quoted.mtype === 'videoMessage' ? 'mp4' : 'mp3';
    const mime = m.quoted.mtype === 'imageMessage' ? 'image/jpeg' : m.quoted.mtype === 'videoMessage' ? 'video/mp4' : 'audio/mpeg';
    const mediaUrl = await uploadMedia(media, ext, mime);
    reply('🔗 *URL:* ' + mediaUrl + '\n\n_Powered by DJOUSSE-TECH-MD_');
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur: ' + error.message); }
});
