const { cmd } = require('../command.cjs');
const QRReader = require('qrcode-reader');
const sharp = require('sharp');

cmd({ pattern: 'qrread', desc: 'Lire un QR code depuis une image', category: 'tools', filename: __filename }, async (conn, m) => {
  if (!m.quoted) return m.reply('❌ Réponds à une image contenant un QR code avec .qrread');
  try {
    const buf = await m.quoted.download();
    if (!buf) return m.reply('❌ Image introuvable.');
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = new QRReader();
    qr.callback = (err, res) => {
      if (err || !res?.result) return m.reply('❌ Aucun QR code détecté.');
      m.reply(`✅ *QR LU:*\n\n${res.result}`);
    };
    qr.decode({ data: data, width: info.width, height: info.height });
  } catch (e) { m.reply('❌ ' + e.message); }
});