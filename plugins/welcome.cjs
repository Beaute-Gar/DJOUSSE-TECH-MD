const { cmd } = require('../command.cjs');
const fs = require('fs');
const DB = './database/welcome.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; }};
cmd({ pattern: 'welcome', desc: 'Afficher les messages de bienvenue/départ du groupe', category: 'group', filename: __filename }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Commande réservée aux groupes.');
const data = load();
const g = data[m.chat];
if (!g) return m.reply('❌ Aucun message configuré pour ce groupe.\nUtilise .setwelcome et .setgoodbye');
let msg = '📋 Configuration bienvenue/départ:\n\n';
if (g.welcome) msg += `👋 Bienvenue:\n${g.welcome}\n\n`;
if (g.goodbye) msg += `🚪 Départ:\n${g.goodbye}\n\n`;
if (!g.welcome && !g.goodbye) msg += 'Aucun message configuré.';
m.reply(msg);
});