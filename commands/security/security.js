const { cmd } = require('../command.cjs');
const fs = require('fs');
const { box } = require('../lib/djousse-ui.cjs');
const DB = './database/security.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return { antiLink: false, antiSpam: true, spamThreshold: 5, antiBadWord: false, antiCall: true }; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'security', desc: 'Configurer les paramètres de sécurité', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const s = load();
if (sub === 'antilink') {
const val = args[1]?.toLowerCase();
if (val === 'on' || val === 'true') { s.antiLink = true; save(s); return m.reply(box('SUCCESS', [{ raw: 'Anti-lien ACTIVÉ.' }])); }
if (val === 'off' || val === 'false') { s.antiLink = false; save(s); return m.reply(box('SUCCESS', [{ raw: 'Anti-lien DÉSACTIVÉ.' }])); }
} else if (sub === 'antispam') {
const val = args[1]?.toLowerCase();
if (val === 'on' || val === 'true') { s.antiSpam = true; save(s); return m.reply(box('SUCCESS', [{ raw: 'Anti-spam ACTIVÉ.' }])); }
if (val === 'off' || val === 'false') { s.antiSpam = false; save(s); return m.reply(box('SUCCESS', [{ raw: 'Anti-spam DÉSACTIVÉ.' }])); }
} else if (sub === 'threshold') {
const t = parseInt(args[1]);
if (t > 0 && t <= 50) { s.spamThreshold = t; save(s); return conn.sendMessage(m.chat, { text: box('SUCCESS', [{ raw: `Seuil anti-spam: ${t} messages/10s` }]) }, { quoted: m }); }
}
m.reply(box('SÉCURITÉ', [
  { label: '🚫 Anti-lien', value: s.antiLink ? '✅' : '❌' },
  { label: '🛡️ Anti-spam', value: `${s.antiSpam ? '✅' : '❌'} (seuil: ${s.spamThreshold})` },
  { label: '🚫 Anti-badword', value: s.antiBadWord ? '✅' : '❌' },
  { label: '📞 Anti-call', value: s.antiCall ? '✅' : '❌' },
  { blank: true },
  { raw: '⚙️ Commandes :' },
  { cmd: 'security antilink on/off', desc: '' },
  { cmd: 'security antispam on/off', desc: '' },
  { cmd: 'security threshold <nombre>', desc: '' },
]));
});
