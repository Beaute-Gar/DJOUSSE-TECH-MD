'use strict';
/* ══════════════════════════════════════════════════════════════════
   INVENTAIRE RÉEL — TEDDY-XMD
   Extrait toutes les commandes (nomCom) des plugins/*.js, avec :
   - la catégorie d'origine
   - le fichier:ligne
   - des marqueurs : obfusqué / sensible (bug/crash/freeze…)
   ══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'C:/Users/Djousse Uriel/Documents/_refs-bots/teddy-xmd';
const PLUG = path.join(ROOT, 'plugins');

const BAD = /\b(bug|crash|freese|freeze|crashx|bugx|boom|hack|hacking|dDoS|dos|termite|worm|payload|invisible|crash2|crash3|fcbug|iosbug|andbug|systemcrash|forceclose|xbug|antibug)\b/i;
const NSFW = /\b(porn|pornoo|pornoo|xxx|sex|sexy|nude|nudes|hentai|hentae|ecchi|rule34|nsfw|xnxx|xvideos|blowjob|onlyfans|leaked)\b/i;
const OBF = /(eval\s*\(|atob\s*\(|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}|Buffer\.from\(['"][A-Za-z0-9+\/=]{200,})/;

const files = fs.readdirSync(PLUG).filter((f) => f.endsWith('.js'));
const cmds = [];
const stats = { files: files.length, obfus: 0, unreadable: 0 };

for (const f of files) {
  const fp = path.join(PLUG, f);
  let src;
  try {
    src = fs.readFileSync(fp, 'utf8');
  } catch {
    stats.unreadable += 1;
    continue;
  }
  if (!src.trim()) continue;
  const obfus = OBF.test(src);
  if (obfus) stats.obfus += 1;

  /* découpage par bloc ezra( ... ) pour associer chaque nomCom à sa catégorie */
  const rx = /nomCom\s*:\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    const name = m[1].trim().toLowerCase();
    if (!name) continue;
    const line = src.slice(0, m.index).split('\n').length;
    /* catégorie : chercher le premier "categorie" du même bloc ezra */
    const after = src.slice(Math.max(0, m.index - 400));
    const catM = after.match(/categorie\s*:\s*['"`]([^'"`]+)['"`]/i);
    cmds.push({
      name,
      cat: catM ? catM[1] : '?',
      file: `plugins/${f}`,
      line,
      obfus,
      bad: BAD.test(name),
      nsfw: NSFW.test(name),
    });
  }
}

/* doublons de noms (le même nomCom plusieurs fois) */
const byName = new Map();
for (const c of cmds) {
  if (!byName.has(c.name)) byName.set(c.name, []);
  byName.get(c.name).push(c);
}
const dupNames = [...byName.entries()].filter(([, v]) => v.length > 1);

const out = {
  total_lignes_commandes: cmds.length,
  noms_uniques: byName.size,
  doublons: dupNames.length,
  stats,
  commandes: cmds,
  doublon_detail: dupNames.map(([n, v]) => `${n} (${v.map((x) => `${x.file}:${x.line}`).join(' , ')})`),
};

const dest = path.join(ROOT, '..', 'teddy-inventaire.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1), 'utf8');
console.log('FICHIERS plugins     :', stats.files);
console.log('COMMandes (lignes)   :', cmds.length);
console.log('Noms uniques         :', byName.size);
console.log('Doublons de nom      :', dupNames.length);
console.log('Fichiers obfusqués   :', stats.obfus);
console.log('Suspects bug/crash   :', cmds.filter((c) => c.bad).length);
console.log('Suspects NSFW        :', cmds.filter((c) => c.nsfw).length);
console.log('→', dest);
