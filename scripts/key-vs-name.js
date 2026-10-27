'use strict';
/* Désaccords clé du registre vs entry.name (l'utilisateur tape la clé,
   le menu affiche peut-être le nom → l'inverse est injoignable). */
const h = require('../src/handlers/handler.js');
const cmds = h.commands;

const rows = [];
for (const [key, e] of cmds) {
  if (!e || !e.name) continue;
  const n = String(e.name).toLowerCase();
  if (n !== key) rows.push({ key, name: n, cat: e.cat, aliases: (e.aliases || []).join('|') });
}

console.log(`registre: ${cmds.size} clés`);
console.log(`désaccords clé≠name: ${rows.length}`);
console.log(`  → où la CLÉ n'est pas un nom connu : ${rows.filter((r) => !rows.some((x) => x.name === r.key)).length}`);

/* Les deux familles : la clé est-elle elle-même un name d'une autre entrée ? */
console.log('\n--- premiers désaccords ---');
for (const r of rows.slice(0, 25)) console.log(`  key=${r.key.padEnd(18)} name=${r.name.padEnd(18)} cat=${r.cat}`);

/* Que montrent les catégories ? clé ou name ? */
console.log('\n--- que affichent les catégories ? ---');
const all = [];
for (let i = 1; i <= 21; i += 1) {
  try {
    const out = h.renderCategory(i);
    if (typeof out === 'string') all.push(out);
    else if (out && typeof out.text === 'string') all.push(out.text);
  } catch { /* catégorie inexistante */ }
}
const menu = all.join('\n').toLowerCase();
console.log(`  texte des menus: ${menu.length} caractères`);
for (const r of rows.slice(0, 12)) {
  const inMenuAsKey = menu.includes(r.key);
  const inMenuAsName = menu.includes(r.name);
  console.log(`  ${r.key.padEnd(18)} clé@menu=${inMenuAsKey}  name@menu=${inMenuAsName}`);
}
fs_report();
function fs_report() {
  const namesInMenu = rows.filter((r) => menu.includes(r.name) && !menu.includes(r.key));
  console.log(`\n  noms AFFICHÉS en menu mais clé ABSENTE: ${namesInMenu.length}`);
  for (const r of namesInMenu.slice(0, 20)) console.log(`     ${r.name} (clé réelle: ${r.key})`);
}
