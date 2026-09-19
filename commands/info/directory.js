const { cmd } = require('../command.cjs');
const { commands } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'directory', desc: 'Afficher l\'index des commandes par catégorie', category: 'utility', filename: __filename }, async (conn, m, commands, config) => {
const cats = {};
commands.forEach(c => {
if (c.dontAddCommandList || !c.pattern) return;
const cat = c.category || 'misc';
if (!cats[cat]) cats[cat] = [];
cats[cat].push(c.pattern);
});
const lines = [];
Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([cat, cmds]) => {
lines.push({ raw: `*${cat.toUpperCase()}* (${cmds.length})` });
cmds.forEach(c => lines.push({ raw: `  .${c}` }));
lines.push({ blank: true });
});
lines.push({ raw: `> ${commands.filter(c => c.pattern).length} commandes au total` });
m.reply(box('ANNUAIRE DES COMMANDES', lines));
});
