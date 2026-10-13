'use strict';
/* Croise l'inventaire TEDDY-XMD avec le registre DJOUSE réel. */
const fs = require('fs');
const path = require('path');
const inv = require('C:/Users/Djousse Uriel/Documents/_refs-bots/teddy-inventaire.json');

/* registre DJOUSE réel */
process.chdir('C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD');
const h = require('C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD/handler');
const dj = new Set();
for (const k of h.commands.keys()) dj.add(String(k).toLowerCase());

const manquantes = [];
const deja = [];
for (const c of inv.commandes) {
  if (dj.has(c.name)) deja.push(c);
  else manquantes.push(c);
}

/* filtre les suspects : bug/crash, NSFW, obfusqué */
const sain = manquantes.filter((c) => !c.bad && !c.nsfw && !c.obfus);
const suspects = manquantes.filter((c) => c.bad || c.nsfw || c.obfus);

/* dédoublonne par nom (garde la 1re occurrence = première déclaration) */
const seen = new Set();
const sainUnique = [];
for (const c of sain) {
  if (seen.has(c.name)) continue;
  seen.add(c.name);
  sainUnique.push(c);
}

/* catégories d'origine */
const parCat = {};
for (const c of sainUnique) parCat[c.cat] = (parCat[c.cat] || 0) + 1;

const out = {
  djousse_entrees: dj.size,
  teddy_total: inv.noms_uniques,
  deja_presentes: deja.length,
  manquantes: manquantes.length,
  manquantes_saines_uniques: sainUnique.length,
  exclus_suspects: suspects.map((c) => `${c.name} — ${c.bad ? 'bug/crash' : ''}${c.nsfw ? 'nsfw' : ''}${c.obfus ? 'obfusqué' : ''} (${c.file}:${c.line})`),
  par_cat: parCat,
  a_porter: sainUnique,
};
fs.writeFileSync(
  'C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD/teddy-manquantes.json',
  JSON.stringify(out, null, 1), 'utf8');

console.log('DJOUSSE (entrées registre) :', dj.size);
console.log('TEDDY (noms uniques)       :', inv.noms_uniques);
console.log('Déjà présentes chez toi    :', deja.length);
console.log('Manquantes                 :', manquantes.length);
console.log('  dont saines (uniques)    :', sainUnique.length);
console.log('  dont exclues (suspectes) :', suspects.length);
console.log('--- catégories des manquantes saines ---');
for (const [k, v] of Object.entries(parCat).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
