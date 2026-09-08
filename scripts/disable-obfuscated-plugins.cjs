// scripts/disable-obfuscated-plugins.cjs
// Désactive les plugins obfusqués en les déplaçant vers plugins/disabled/
// (ignorés par index.cjs car le scan n'est pas récursif).
// Usage : node scripts/disable-obfuscated-plugins.cjs [--force]

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const disabledDir = path.join(pluginsDir, 'disabled');

const force = process.argv.includes('--force');

function detectObfuscated(file) {
  if (!file.endsWith('.cjs')) return false;
  const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
  const lines = content.split(/\r?\n/).length;
  return lines <= 3 && content.length > 200 && /_0x[a-f0-9]{4,}/.test(content);
}

const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.cjs') && f !== '_bridge-loader.cjs');
const obfuscated = files.filter(detectObfuscated);

console.log(`🔍 ${obfuscated.length} plugins obfusqués détectés`);
console.log('');

if (obfuscated.length === 0) {
  console.log('✅ Aucun plugin à désactiver.');
  process.exit(0);
}

console.log(obfuscated.map(f => '  - ' + f).join('\n'));
console.log('');

if (!force) {
  console.log('ℹ️  Aucun déplacement effectué. Ajoutez --force pour désactiver ces plugins.');
  console.log('   Ex: node scripts/disable-obfuscated-plugins.cjs --force');
  process.exit(0);
}

if (!fs.existsSync(disabledDir)) {
  fs.mkdirSync(disabledDir, { recursive: true });
}

let moved = 0;
for (const file of obfuscated) {
  const src = path.join(pluginsDir, file);
  const dest = path.join(disabledDir, file);
  fs.renameSync(src, dest);
  console.log(`🔒 Désactivé: ${file}`);
  moved++;
}

console.log(`\n✅ ${moved} plugins déplacés vers plugins/disabled/`);
console.log('📦 Backup automatique: les fichiers sont déplacés, pas supprimés.');
console.log('♻️  Pour réactiver: déplacer le fichier de plugins/disabled/ vers plugins/');
