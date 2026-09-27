/**
 * migrate-style.cjs — Migre automatiquement toutes les commandes au style HACKER
 * Usage : node migrate-style.cjs
 */

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, 'commands');

// Remplacements automatiques
const REPLACEMENTS = [
  // Box avec label/value → boxWithFooter
  {
    pattern: /m\.reply\(box\(['"`]([^'"`]+)['"`],\s*\[([\s\S]*?)\]\)\)/g,
    replace: (match, title, content) => {
      return `m.reply(boxWithFooter('${title}', [${content}]))`;
    },
  },
  // reply(box(...)) → reply(boxWithFooter(...))
  {
    pattern: /reply\(box\(['"`]([^'"`]+)['"`],\s*\[([\s\S]*?)\]\)\)/g,
    replace: (match, title, content) => {
      return `reply(boxWithFooter('${title}', [${content}]))`;
    },
  },
];

// Ajouter le require si absent
const REQUIRE_LINE = `const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');`;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Ajouter le require si absent
  if (!content.includes('boxWithFooter') && content.includes("djousse-ui.cjs")) {
    content = content.replace(
      /require\(['"`]\.\.\/lib\/djousse-ui\.cjs['"`]\)/,
      `require('../lib/djousse-ui.cjs')`
    );
    content = content.replace(
      /const \{ box \} = require\(['"`]\.\.\/lib\/djousse-ui\.cjs['"`]\)/,
      REQUIRE_LINE
    );
    modified = true;
  }

  // Remplacer box() par boxWithFooter()
  for (const { pattern, replace } of REPLACEMENTS) {
    const newContent = content.replace(pattern, replace);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Migré : ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
      try {
        processFile(fullPath);
      } catch (e) {
        console.error(`❌ ${fullPath}: ${e.message}`);
      }
    }
  }
}

console.log('🚀 Migration vers style HACKER...\n');
walkDir(COMMANDS_DIR);
console.log('\n✅ Migration terminée !');
