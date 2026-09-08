const { cmd } = require('../command.cjs');
const fs = require('fs');
const { box } = require('../lib/djousse-ui.cjs');
const DB = './database/welcome.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'setwelcome', desc: 'Définir le message de bienvenue du groupe', category: 'group', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Commande réservée aux groupes.');
const msg = m.body.split(' ').slice(1).join(' ');
if (!msg) return conn.sendMessage(m.chat, { text: box('👋 *BIENVENUE*', [
  { raw: 'Utilisation :' },
  { raw: '.setwelcome Bienvenue @user !' },
  { blank: true },
  { raw: '*Variables :*' },
  { raw: '• @user — Nouveau membre' },
  { raw: '• @group — Nom du groupe' },
  { raw: '• @count — Nombre de membres' },
]) }, { quoted: m });
const data = load();
data[m.chat] = { welcome: msg };
save(data);
conn.sendMessage(m.chat, { text: box('👋 *BIENVENUE*', [
  { label: 'Statut', value: '✅ Défini' },
  { blank: true },
  { raw: `*${msg}*` },
]) }, { quoted: m });
});