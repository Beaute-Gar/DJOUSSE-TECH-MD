const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
const fs = require('fs');
cmd({ pattern: 'save', desc: 'Sauvegarder un média en local', category: 'media', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.quoted) return m.reply('❌ Réponds à un média (image/video/audio) avec .save');
const types = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
const type = types.find(t => m.quoted.msg?.[t] || m.quoted.type === t);
if (!type) return m.reply('❌ Aucun média trouvé.');
const ext = type === 'imageMessage' ? 'jpg' : type === 'videoMessage' ? 'mp4' : type === 'audioMessage' ? 'mp3' : type === 'stickerMessage' ? 'webp' : 'bin';
const safeName = `DJ_${Date.now()}.${ext}`;
const buffer = await downloadMediaMessage(m.quoted, 'save');
if (!buffer) return m.reply('❌ Erreur sauvegarde.');
const dir = './database/media';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/${safeName}`, buffer);
conn.sendMessage(m.chat, { text: `✅ Média sauvegardé: ${safeName}\n📁 ${dir}/${safeName}` }, { quoted: m });
});