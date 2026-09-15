const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/security.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return { antiLink: false, antiSpam: true, spamThreshold: 5, antiBadWord: false, antiCall: true }; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'security', desc: 'Configurer les paramètres de sécurité', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const s = load();
if (sub === 'antilink') {
const val = args[1]?.toLowerCase();
if (val === 'on' || val === 'true') { s.antiLink = true; save(s); return m.reply('✅ Anti-lien ACTIVÉ.'); }
if (val === 'off' || val === 'false') { s.antiLink = false; save(s); return m.reply('✅ Anti-lien DÉSACTIVÉ.'); }
} else if (sub === 'antispam') {
const val = args[1]?.toLowerCase();
if (val === 'on' || val === 'true') { s.antiSpam = true; save(s); return m.reply('✅ Anti-spam ACTIVÉ.'); }
if (val === 'off' || val === 'false') { s.antiSpam = false; save(s); return m.reply('✅ Anti-spam DÉSACTIVÉ.'); }
} else if (sub === 'threshold') {
const t = parseInt(args[1]);
if (t > 0 && t <= 50) { s.spamThreshold = t; save(s); return conn.sendMessage(m.chat, { text: `✅ Seuil anti-spam: ${t} messages/10s` }, { quoted: m }); }
}
let msg = '🔒 *Sécurité*\n\n';
msg += `🚫 Anti-lien: ${s.antiLink ? '✅' : '❌'}\n`;
msg += `🛡️ Anti-spam: ${s.antiSpam ? '✅' : '❌'} (seuil: ${s.spamThreshold})\n`;
msg += `🚫 Anti-badword: ${s.antiBadWord ? '✅' : '❌'}\n`;
msg += `📞 Anti-call: ${s.antiCall ? '✅' : '❌'}\n\n`;
msg += `⚙️ Commandes:\n.security antilink on/off\n.security antispam on/off\n.security threshold <nombre>`;
m.reply(msg);
});