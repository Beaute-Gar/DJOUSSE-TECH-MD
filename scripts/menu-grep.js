'use strict';
/* Cherche quels noms de commandes apparaissent VRAIMENT dans les menus
   (le rendu est stylisé en lettres mathématiques → on dé-stylise d'abord). */
const h = require('../src/handlers/handler.js');

const DESTYLE = (() => {
  const m = new Map();
  const build = (s, chars) => { for (let i = 0; i < chars.length; i += 1) m.set(s + i, chars[i]); };
  build(0x1D670, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  build(0x1D68A, 'abcdefghijklmnopqrstuvwxyz');
  build(0x1D7F6, '0123456789');
  return m;
})();
const destyle = (s) => String(s || '').replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => DESTYLE.get(ch.codePointAt(0)) || ch);

const pages = [];
for (let i = 1; i <= 21; i += 1) {
  try {
    const out = h.renderCategory(i);
    pages.push(typeof out === 'string' ? out : (out && out.text) || '');
  } catch { /* catégorie inexistante */ }
}
try { pages.push(h.renderMainMenu()); } catch { /* ignore */ }
try { pages.push(h.renderGroupMenu()); } catch { /* ignore */ }

const menu = destyle(pages.join('\n')).toLowerCase();
console.log(`menus dé-stylisés: ${menu.length} caractères`);

/* Couverture : les noms testés par mon balayage (= entry.name) sont-ils
   ceux que l'utilisateur voit en menu ? */
const cmds = h.commands;
const byName = new Map();
for (const [k, e] of cmds) {
  if (e && e.name && !byName.has(String(e.name).toLowerCase())) byName.set(String(e.name).toLowerCase(), k);
}

let nameInMenu = 0;
let nameAbsent = 0;
const absents = [];
for (const [name, key] of byName) {
  const shown = menu.includes(name) || menu.includes('.' + name);
  if (shown) nameInMenu += 1;
  else { nameAbsent += 1; if (absents.length < 25) absents.push(`${name} (clé: ${key})`); }
}
console.log(`\nnoms (entry.name) présents dans un menu: ${nameInMenu}`);
console.log(`noms absents des menus             : ${nameAbsent}`);
console.log('\n--- exemples de noms ABSENTS des menus ---');
for (const a of absents) console.log('   ' + a);

console.log('\n--- commandes litigieuses ---');
for (const n of ['invitelink', 'resetlink', 'groupinvite', 'newlink', 'link', 'revokelink', 'kick', 'sticker', 'newsletter', 'setgreet', 'rules', 'setbgm', 'terminategc']) {
  const inMenu = menu.includes(n) || menu.includes('.' + n);
  const hasKey = cmds.has(n);
  console.log(`   ${n.padEnd(15)} clé=${hasKey ? 'OUI' : 'non'}  menu=${inMenu ? 'AFFICHÉ' : 'absent'}`);
}
