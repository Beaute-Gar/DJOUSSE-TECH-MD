'use strict';
/* Inventaire réel de silva-md : extraction des noms de commandes. */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Djousse Uriel/Documents/_refs-bots/silva-md';
const PLUG = path.join(ROOT, 'plugins');

const BAD = /\b(bug|crash|freese|freeze|boom|hack|hacking|dos|termite|worm|payload|invisible|fcbug|iosbug|andbug|systemcrash|forceclose|xbug|antiview|crashbot|forcecrash)\b/i;
const NSFW = /\b(porn|porno|xxx|sex|sexy|nude|nudes|hentai|hentae|ecchi|rule34|nsfw|xnxx|xvideos|blowjob|onlyfans|leaked|boobs|dick|pussy)\b/i;
const OBF = /(eval\s*\(|atob\s*\(|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}|Buffer\.from\(['"][A-Za-z0-9+\/=]{200,})/;

const files = fs.readdirSync(PLUG).filter((f) => f.endsWith('.js'));
const cmds = [];
let obfusCount = 0;
for (const f of files) {
  const fp = path.join(PLUG, f);
  let src;
  try { src = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  if (!src.trim()) continue;
  const obfus = OBF.test(src);
  if (obfus) obfusCount += 1;
  /* motifs de déclaration rencontrés dans les bots style "ezra/baileys" */
  const motifs = [
    /nomCom\s*:\s*['"`]([^'"`]+)['"`]/g,
    /command\s*:\s*['"`]([a-z0-9\-_]+)['"`]/gi,
    /\bcmd\s*\(\s*['"`]([a-z0-9\-_]+)['"`]/gi,
    /commands\s*:\s*\[([^\]]+)\]/g,
  ];
  for (const rx of motifs) {
    let m;
    while ((m = rx.exec(src)) !== null) {
      if (rx.source.includes('commands')) {
        /* forme silva-md : commands: ['a','b'] */
        const noms = m[1].match(/['"`]([^'"`]+)['"`]/g) || [];
        const line = src.slice(0, m.index).split('\n').length;
        const after = src.slice(Math.max(0, m.index - 500));
        const catM = after.match(/(?:categor(?:y|ie)|cat)\s*:\s*['"`]([^'"`]+)['"`]/i);
        for (const n of noms) {
          const name = n.slice(1, -1).trim().toLowerCase();
          if (!name || name.length > 40) continue;
          cmds.push({
            name, cat: catM ? catM[1] : '?', file: `plugins/${f}`, line,
            obfus, bad: BAD.test(name), nsfw: NSFW.test(name),
          });
        }
        continue;
      }
      const name = m[1].trim().toLowerCase();
      if (!name || name.length > 40) continue;
      const line = src.slice(0, m.index).split('\n').length;
      const after = src.slice(Math.max(0, m.index - 500));
      const catM = after.match(/(?:categor(?:y|ie)|cat)\s*:\s*['"`]([^'"`]+)['"`]/i);
      cmds.push({
        name, cat: catM ? catM[1] : '?', file: `plugins/${f}`, line,
        obfus, bad: BAD.test(name), nsfw: NSFW.test(name),
      });
    }
  }
}
const byName = new Map();
for (const c of cmds) {
  if (!byName.has(c.name)) byName.set(c.name, []);
  byName.get(c.name).push(c);
}
const out = {
  total_lignes: cmds.length,
  noms_uniques: byName.size,
  fichiers: files.length,
  fichiers_obfusques: obfusCount,
  commandes: cmds,
};
fs.writeFileSync(path.join(ROOT, '..', 'silva-inventaire.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('FICHIERS        :', files.length);
console.log('COMMANDES (lign):', cmds.length);
console.log('NOMS UNIQUES    :', byName.size);
console.log('OBFUSQUÉS       :', obfusCount);
console.log('suspects bug    :', cmds.filter((c) => c.bad).length);
console.log('suspects nsfw   :', cmds.filter((c) => c.nsfw).length);
