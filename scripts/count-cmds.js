'use strict';
/* Compte réel des commandes par catégorie, depuis le registre chargé. */
try {
  const h = require('../handler');
  const cmds = h.commands;
  if (!cmds || typeof cmds.size !== 'number') {
    console.log('REGISTRE INDISPONIBLE', Object.keys(h));
    process.exit(0);
  }
  const seen = new Map();
  for (const entry of cmds.values()) {
    if (!entry || !entry.name) continue;
    if (seen.has(entry.name)) continue;
    seen.set(entry.name, entry.cat || 1);
  }
  const byCat = new Map();
  for (const cat of seen.values()) byCat.set(cat, (byCat.get(cat) || 0) + 1);
  console.log('TOTAL COMMANDES (noms uniques):', seen.size);
  const entrées = cmds.size;
  console.log('ENTREES REGISTRE (noms+alias):', entrées);
  let sum = 0;
  for (const [cat, n] of [...byCat.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`cat ${cat}: ${n}`);
    sum += n;
  }
  console.log('somme:', sum);
} catch (e) {
  console.log('ERREUR CHARGEMENT:', e.message);
}
