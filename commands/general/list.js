const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'list',
  alias: ['cmdlist'],
  desc: 'Liste toutes les commandes',
  category: 'main',
  filename: __filename,
}, async (conn, m, args, { from, reply }) => {
  const { commandMap } = require('../command.cjs');
  const seen = new Set();
  const cats = {};
  for (const [name, cmd] of commandMap) {
    const cmdName = cmd.name || cmd.pattern;
    if (!cmdName || typeof cmdName !== 'string' || seen.has(cmdName)) continue;
    seen.add(cmdName);
    const cat = (cmd.category || 'OTHER').toUpperCase();
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(cmdName);
  }
  const lines = [];
  for (const [cat, cmds] of Object.entries(cats).sort()) {
    lines.push({ raw: `*${cat}* (${cmds.length})` });
    for (const c of cmds.sort()) lines.push({ raw: `.${c} ` });
    lines.push({ blank: true });
  }
  lines.push({ raw: `Total: ${seen.size} commandes` });
  return reply(box('COMMANDES', lines));
});
