const { cmd } = require('../command.cjs');
const { commands } = require('../command.cjs');
cmd({ pattern: 'directory', desc: 'Afficher l\'index des commandes par catégorie', category: 'utility', filename: __filename }, async (conn, m, commands, config) => {
const cats = {};
commands.forEach(c => {
if (c.dontAddCommandList || !c.pattern) return;
const cat = c.category || 'misc';
if (!cats[cat]) cats[cat] = [];
cats[cat].push(c.pattern);
});
let msg = '📂 *Annuaire des commandes*\n\n';
Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([cat, cmds]) => {
msg += `*${cat.toUpperCase()}* (${cmds.length})\n`;
cmds.forEach(c => msg += `  .${c}\n`);
msg += '\n';
});
msg += `> ${commands.filter(c => c.pattern).length} commandes au total`;
m.reply(msg);
});