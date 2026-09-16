const { cmd } = require('../command.cjs');
cmd({ pattern: 'style', desc: 'Transformer du texte en différents styles', category: 'utility', filename: __filename }, async (conn, m, commands, config) => {
const text = m.body.split(' ').slice(1).join(' ');
if (!text) return m.reply('❌ Usage: .style <texte>\n\nStyles disponibles:\n1. Bold: **texte**\n2. Italic: *texte*\n3. Strikethrough: ~texte~\n4. Monospace: ```texte```');
const styles = {
'bold': text.split('').map(c => isNaN(c) ? String.fromCharCode(55349, 56800 + (c.charCodeAt(0) > 96 && c.charCodeAt(0) < 123 ? c.charCodeAt(0) - 97 : (c.charCodeAt(0) > 64 && c.charCodeAt(0) < 91 ? c.charCodeAt(0) - 65 + 32 : 0))) : c).join(''),
'script': text.split('').map(c => isNaN(c) ? String.fromCharCode(55349, 56960 + Math.min(c.charCodeAt(0) % 26, 25)) : c).join(''),
'fraktur': text.split('').map(c => isNaN(c) ? String.fromCharCode(55349, 56768 + Math.min(c.charCodeAt(0) % 26, 25)) : c).join(''),
'double': text.split('').map(c => isNaN(c) ? String.fromCharCode(55349, 56576 + Math.min(c.charCodeAt(0) % 26, 25)) : c).join(''),
}
let msg = '🎨 Styles pour: "'+text+'"\n\n';
msg += `𝐁𝐨𝐥𝐝: ${styles.bold}\n\n`;
msg += `𝓢𝓬𝓻𝓲𝓹𝓽: ${styles.script}\n\n`;
msg += `𝔉𝔯𝔞𝔨𝔱𝔲𝔯: ${styles.fraktur}\n\n`;
msg += `𝔻𝕠𝕦𝕓𝕝𝕖: ${styles.double}`;
m.reply(msg);
});