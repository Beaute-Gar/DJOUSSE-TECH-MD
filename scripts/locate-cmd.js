'use strict';
/* Diagnose : localise la définition de commandes précises dans src/ */
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('src');

const targets = process.argv.slice(2);
const patterns = [
  /\b(?:cmd|command|reg|register|addCommand|onCommand)\s*\(\s*['"]([a-z0-9_]+)['"]/gi,
  /\bname\s*:\s*['"]([a-z0-9_]+)['"]/g,
  /\bcommands\s*:\s*\[([^\]]*)\]/g,
];

const found = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  for (const re of patterns) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const names = re.source.includes('commands')
        ? m[1].match(/['"][a-z0-9_]+['"]/g) || []
        : [`'${m[1]}'`];
      for (const raw of names) {
        const n = raw.replace(/['"]/g, '').toLowerCase();
        if (!targets.includes(n)) continue;
        const before = src.slice(0, m.index);
        const line = before.split(/\r?\n/).length;
        if (!found.has(n)) found.set(n, []);
        found.get(n).push(`${f}:${line} → ${lines[line - 1].trim().slice(0, 120)}`);
      }
    }
  }
}

for (const t of targets) {
  console.log(`\n══ ${t} ══`);
  const hits = found.get(t);
  if (!hits) console.log('   (aucune définition trouvée)');
  else for (const h of [...new Set(hits)]) console.log('   ' + h);
}
