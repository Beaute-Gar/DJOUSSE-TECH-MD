const { cmd } = require('../command.cjs');
const fs = require('fs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;
const DB = './database/personality.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return { style: 'default', temperature: 0.7, systemPrompt: 'Tu es DJOUSSE TECH, un assistant WhatsApp intelligent et serviable.' }; }};
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
cmd({ pattern: 'personality', desc: 'Configurer la personnalité du bot', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const p = load();
if (sub === 'style') {
const style = args.slice(1).join(' ');
if (!style) return m.reply(boxWithFooter('🎭 *PERSONNALITÉ IA*', [
  { raw: 'Utilisation :' },
  { raw: '.personality style <description>' },
  { blank: true },
  { raw: 'Exemple :' },
  { raw: '.personality style formel et professionnel' },
]));
p.style = style; save(p);
return conn.sendMessage(m.chat, { text: box('🎭 *PERSONNALITÉ IA*', [
  { label: 'Actuelle', value: `*${style}*` },
  { label: 'Statut', value: '✅ Mis à jour' },
]) }, { quoted: m });
} else if (sub === 'prompt') {
const prompt = args.slice(1).join(' ');
if (!prompt) return m.reply(boxWithFooter('🎭 *PERSONNALITÉ IA*', [
  { raw: 'Utilisation :' },
  { raw: '.personality prompt <instruction système>' },
]));
p.systemPrompt = prompt; save(p);
return m.reply(boxWithFooter('🎭 *PERSONNALITÉ IA*', [
  { label: 'Statut', value: '✅ Prompt mis à jour' },
]));
}
conn.sendMessage(m.chat, { text: box('🎭 *PERSONNALITÉ IA*', [
  { label: 'Actuelle', value: `*${p.style}*` },
  { label: 'Température', value: `*${p.temperature}*` },
  { blank: true },
  { raw: '*Commandes :*' },
  { raw: '• .personality style <description>' },
  { raw: '• .personality prompt <instruction>' },
]) }, { quoted: m });
});