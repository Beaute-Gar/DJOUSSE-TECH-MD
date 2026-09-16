const { cmd } = require('../command.cjs');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

cmd({
  pattern: 'url2',
  react: '🔗',
  desc: 'Uploader sur Imgur',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (!m.quoted || !m.quoted.message) return reply('❌ Réponds à une image ou vidéo avec .url2');
  try {
    await m.react('⏳').catch(() => {});
    const message = m.quoted.message;
    let mimeType = '', mediaMessage;
    if (message.imageMessage) { mimeType = 'image/jpeg'; mediaMessage = message.imageMessage; }
    else if (message.videoMessage) { mimeType = 'video/mp4'; mediaMessage = message.videoMessage; }
    else if (message.stickerMessage) { mimeType = 'image/webp'; mediaMessage = message.stickerMessage; }
    if (!mediaMessage) return reply('❌ Type non supporté.');
    const fileBuffer = await m.quoted.download();
    if (!fileBuffer) return reply('❌ Échec du téléchargement.');
    const fileExt = mimeType.includes('video') ? 'mp4' : 'jpg';
    const tempFilePath = path.join(os.tmpdir(), 'temp_media.' + fileExt);
    fs.writeFileSync(tempFilePath, fileBuffer);
    const formData = new FormData();
    formData.append('image', fs.createReadStream(tempFilePath));
    const response = await axios.post('https://api.imgur.com/3/upload', formData, { headers: { ...formData.getHeaders(), Authorization: 'Client-ID ' + (process.env.IMGUR_CLIENT_ID || '51c547f88a81855') } });
    fs.unlinkSync(tempFilePath);
    if (!response.data?.data?.link) throw new Error('Upload échoué.');
    reply('🔗 *URL:* ' + response.data.data.link + '\n\n_Powered by DJOUSSE-TECH-MD_');
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur: ' + (error.message || error)); }
});
