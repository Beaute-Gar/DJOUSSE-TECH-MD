'use strict';
/* Croise silva-md avec le registre DJOUSE réel et classe les manquantes. */
const fs = require('fs');
const inv = require('C:/Users/Djousse Uriel/Documents/_refs-bots/silva-inventaire.json');

process.chdir('C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD');
const h = require('C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD/handler');
const dj = new Set();
for (const k of h.commands.keys()) dj.add(String(k).toLowerCase());

/* exclus par règle de sécurité (déjà établis avec TEDDY) */
const EXCLURE = /loccrash|crashbug|amountbug|pmbug|delaybug|docubug|unlimitedbug|bombug|lagbug|trollybug|terminate|hentai|hwaifu|trap|hneko|hentaivid|blowjobs|waifues|pmbug/;

const manquantes = [];
const deja = [];
for (const c of inv.commandes) {
  if (dj.has(c.name)) deja.push(c);
  else if (EXCLURE.test(c.name)) { /* exclu sécurité */ }
  else manquantes.push(c);
}
/* unique par nom */
const vu = new Set();
const uniques = [];
for (const c of manquantes) { if (!vu.has(c.name)) { vu.add(c.name); uniques.push(c); } }

const suspects = inv.commandes.filter((c) => c.bad || c.nsfw || c.obfus);
const sain = uniques.filter((c) => !c.bad && !c.nsfw && !c.obfus);

const parFichier = {};
for (const c of sain) parFichier[c.file] = (parFichier[c.file] || 0) + 1;
const parCat = {};
for (const c of sain) parCat[c.cat] = (parCat[c.cat] || 0) + 1;

fs.writeFileSync('C:/Users/Djousse Uriel/Documents/DJOUSSE-TECH-MD/silva-manquantes.json', JSON.stringify({
  djousse_entrees: dj.size, silva_total: inv.noms_uniques, deja: deja.length,
  manquantes_uniques: uniques.length, saines: sain.length, a_porter: sain,
}, null, 1), 'utf8');

console.log('DJOUSSE (entrées)      :', dj.size);
console.log('SILVA (noms uniques)   :', inv.noms_uniques);
console.log('Déjà chez toi          :', deja.length);
console.log('Manquantes (uniques)   :', uniques.length);
console.log('dont saines à porter   :', sain.length);
console.log('exclues (bug/nsfw/obfu):', uniques.length - sain.length);
console.log('--- répartition par fichier (top 15) ---');
for (const [f, n] of Object.entries(parFichier).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${f}: ${n}`);
