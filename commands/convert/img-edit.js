const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const os = require('os');
const path = require('path');

async function uploadToCatbox(buffer) {
  const tmpPath = path.join(os.tmpdir(), `catbox_${Date.now()}.png`);
  fs.writeFileSync(tmpPath, buffer);
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(tmpPath));
  const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  fs.unlinkSync(tmpPath);
  return data.trim();
}

async function getSourceMedia(conn, m) {
  const src = m.quoted && m.quoted.msg ? m.quoted : m;
  const type = src.type || src.mtype;
  if (type !== 'imageMessage') return null;
  return await downloadMediaMessage(src);
}

cmd({ pattern: 'blur', desc: 'Blur an image', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('BLUR', [{ raw: 'Reply to an image with .blur' }]));
    reply(boxWithFooter('BLUR', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/blur?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('BLUR', [{ raw: 'Blurred image' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('BLUR', [{ raw: 'Error: ' + e.message }]));
  }
});

cmd({ pattern: 'grey', desc: 'Grayscale an image', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('GREY', [{ raw: 'Reply to an image with .grey' }]));
    reply(boxWithFooter('GREY', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/grey?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('GREY', [{ raw: 'Grayscale image' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('GREY', [{ raw: 'Error: ' + e.message }]));
  }
});

cmd({ pattern: 'gray', desc: 'Grayscale an image', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('GRAY', [{ raw: 'Reply to an image with .gray' }]));
    reply(boxWithFooter('GRAY', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/grey?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('GRAY', [{ raw: 'Grayscale image' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('GRAY', [{ raw: 'Error: ' + e.message }]));
  }
});

cmd({ pattern: 'invert', desc: 'Invert image colors', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('INVERT', [{ raw: 'Reply to an image with .invert' }]));
    reply(boxWithFooter('INVERT', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/invert?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('INVERT', [{ raw: 'Inverted image' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('INVERT', [{ raw: 'Error: ' + e.message }]));
  }
});

cmd({ pattern: 'jail', desc: 'Apply jail effect', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('JAIL', [{ raw: 'Reply to an image with .jail' }]));
    reply(boxWithFooter('JAIL', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/jail?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('JAIL', [{ raw: 'Jailed!' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('JAIL', [{ raw: 'Error: ' + e.message }]));
  }
});

cmd({ pattern: 'ad', desc: 'Apply AD effect', category: 'convert', filename: __filename }, async (conn, m, args, { reply }) => {
  try {
    const media = await getSourceMedia(conn, m);
    if (!media) return reply(boxWithFooter('AD', [{ raw: 'Reply to an image with .ad' }]));
    reply(boxWithFooter('AD', [{ raw: 'Processing...' }]));
    const catboxUrl = await uploadToCatbox(media);
    const { data: result } = await axios.get(`https://apis.davidcyriltech.my.id/ad?url=${encodeURIComponent(catboxUrl)}`, { responseType: 'arraybuffer' });
    await conn.sendMessage(m.chat, { image: Buffer.from(result), caption: boxWithFooter('AD', [{ raw: 'AD effect applied' }]) }, { quoted: m });
  } catch (e) {
    reply(boxWithFooter('AD', [{ raw: 'Error: ' + e.message }]));
  }
});
