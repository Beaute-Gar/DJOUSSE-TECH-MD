'use strict';
/* Diagnose : affiche quelle fonction handler est réellement enregistrée
   pour une commande donnée (le code parle : on reconnaît le fichier). */
const h = require('../src/handlers/handler.js');
const cmds = h.commands;

const names = process.argv.slice(2);
console.log('=== registre : ' + cmds.size + ' clés ===\n');

for (const n of names) {
  const e = cmds.get(n);
  console.log(`══ ${n} ══`);
  if (!e) { console.log('   CLÉ ABSENTE du registre'); console.log(''); continue; }
  console.log(`   key≠name ? name=${JSON.stringify(e.name)} aliases=${JSON.stringify(e.aliases || [])}`);
  console.log(`   cat=${e.cat} owner=${!!e.owner} group=${!!e.group} admin=${!!e.admin} botAdmin=${!!e.botAdmin} requiresInput=${!!e.requiresInput}`);
  console.log(`   desc=${JSON.stringify(e.desc).slice(0, 100)} usage=${JSON.stringify(e.usage || '').slice(0, 60)}`);
  const src = typeof e.handler === 'function' ? e.handler.toString() : String(typeof e.handler);
  const first = src.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6).join(' ⏎ ');
  console.log(`   handler (début) : ${first.slice(0, 420)}`);
  console.log('');
}

/* Les 6 clés supprimées en PHASE B : existe-t-il une entrée dont le NOM
   est ce nom (donc affichable en menu mais injoignable au clavier) ? */
console.log('══ NOMS SUPPRIMÉS EN PHASE B — incohérences name vs key ══');
for (const nom of ['gi', 'memberlist', 'gcinfo', 'groupdesc', 'invitelink', 'resetlink']) {
  const hasKey = cmds.has(nom);
  const byName = [...cmds.values()].find((e) => e && String(e.name).toLowerCase() === nom);
  console.log(
    `   ${nom.padEnd(13)} clé=${hasKey ? 'OUI' : 'NON'}  entrée(name)=${byName ? 'OUI → clé réelle=' + [...cmds.entries()].find(([, v]) => v === byName)?.[0] : 'non'}`
  );
}
