const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITAIRES GROUPE — VCF, Anti-spam, Anti-delete — adaptés de N-main
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── VCF ─────────────────────────────────────────────────────────────────
cmd({
  pattern: 'vcf',
  react: '📇',
  desc: 'Exporter les contacts du groupe en fichier VCF',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  await m.react('🕐').catch(() => {});
  try {
    const meta = await conn.groupMetadata(m.chat);
    let vcf = 'BEGIN:VCARD\nVERSION:3.0\n';
    meta.participants.forEach((p, i) => {
      const num = p.id.split('@')[0];
      vcf += 'FN:' + meta.subject + ' Contact ' + (i + 1) + '\nTEL;type=CELL;waid=' + num + ':+' + num + '\n';
    });
    vcf += 'END:VCARD\n';
    await conn.sendMessage(m.chat, {
      document: Buffer.from(vcf, 'utf-8'),
      mimetype: 'text/vcard',
      fileName: meta.subject + '_contacts.vcf',
    }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── SAVE ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'save',
  react: '💾',
  desc: 'Renvoyer le dernier message/media',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted || m;
  if (!target) return reply('❌ Cite un message à sauvegarder.');
  try {
    const type = target.mtype || target.type;
    if (type === 'imageMessage') {
      const buf = await target.download();
      await conn.sendMessage(m.chat, { image: buf, caption: target.text || '💾 *Message sauvegardé*' }, { quoted: m });
    } else if (type === 'videoMessage') {
      const buf = await target.download();
      await conn.sendMessage(m.chat, { video: buf, caption: target.text || '💾 *Message sauvegardé*' }, { quoted: m });
    } else if (type === 'audioMessage') {
      const buf = await target.download();
      await conn.sendMessage(m.chat, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: m });
    } else if (type === 'stickerMessage') {
      const buf = await target.download();
      await conn.sendMessage(m.chat, { sticker: buf }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { text: target.text || target.body || '💾 *Message sauvegardé*' }, { quoted: m });
    }
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TOQR ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'toqr',
  react: '🔳',
  desc: 'Convertir un texte en QR code',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply('🔳 *Utilisation:* .toqr <texte ou lien>');
  try {
    const QRCode = require('qrcode');
    const buffer = await QRCode.toBuffer(q, { width: 512, margin: 2 });
    await conn.sendMessage(m.chat, { image: buffer, caption: '🔳 *QR Code généré*' }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TOMP3 ───────────────────────────────────────────────────────────────
cmd({
  pattern: 'tomp3',
  react: '🎵',
  desc: 'Convertir une vidéo en audio',
  category: 'convert',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'videoMessage' ? m.quoted : null;
  if (!target) return reply('❌ Cite une vidéo avec .tomp3');
  try {
    await m.react('🕐').catch(() => {});
    const { downloadMediaMessage } = require('../lib/msg.cjs');
    const buffer = await downloadMediaMessage(target, 'buffer', {});
    const ffmpeg = require('fluent-ffmpeg');
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tmpIn = path.join(os.tmpdir(), 'tomp3_' + Date.now() + '.mp4');
    const tmpOut = path.join(os.tmpdir(), 'tomp3_' + Date.now() + '.mp3');
    fs.writeFileSync(tmpIn, buffer);
    await new Promise((resolve, reject) => {
      ffmpeg(tmpIn).audioBitrate(128).format('mp3').on('end', resolve).on('error', reject).save(tmpOut);
    });
    const audio = fs.readFileSync(tmpOut);
    await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg' }, { quoted: m });
    fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut);
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TOIMAGE ─────────────────────────────────────────────────────────────
cmd({
  pattern: 'toimage',
  alias: ['toimg'],
  react: '🖼️',
  desc: 'Convertir un sticker en image',
  category: 'convert',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'stickerMessage' ? m.quoted : null;
  if (!target) return reply('❌ Cite un sticker avec .toimage');
  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    const sharp = require('sharp');
    const imgBuffer = await sharp(buffer).png().toBuffer();
    await conn.sendMessage(m.chat, { image: imgBuffer, caption: '🖼️ *Sticker converti en image*' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── UPTIME ──────────────────────────────────────────────────────────────
cmd({
  pattern: 'uptime',
  alias: ['up'],
  react: '⏱️',
  desc: 'Afficher le temps de fonctionnement',
  category: 'info',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const { uptime } = require('../lib/djousse-ui.cjs');
  const os = require('os');
  const text = box('⏱️ *UPTIME*', [
    { label: 'Bot', value: uptime(process.uptime()) },
    { label: 'Serveur', value: uptime(os.uptime()) },
    { label: 'Mémoire', value: (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB' },
  ]);
  await conn.sendMessage(m.chat, { text }, { quoted: m });
});

// ─── VERSION ─────────────────────────────────────────────────────────────
cmd({
  pattern: 'version',
  react: 'ℹ️',
  desc: 'Afficher la version du bot',
  category: 'info',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const pkg = require('../package.json');
  const text = box('ℹ️ *VERSION*', [
    { label: 'Bot', value: pkg.name + ' v' + pkg.version },
    { label: 'Baileys', value: require('@whiskeysockets/baileys/package.json').version },
    { label: 'Node', value: process.version },
    { label: 'Plateforme', value: process.platform },
  ]);
  await conn.sendMessage(m.chat, { text }, { quoted: m });
});
