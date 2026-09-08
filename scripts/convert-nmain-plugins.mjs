/**
 * Script de conversion des plugins N-main → DJOUSSE-TECH-MD
 * Convertit les 141 plugins ESM de N-main en fichiers .mjs
 * avec seulement les noms/changements de marque
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NMAIN_DIR = path.join(__dirname, '..', '.tmp-nmain', 'N-main', 'inconnu', 'inconnuTech');
const OUTPUT_DIR = path.join(__dirname, 'plugins');

// Conversions de marque
const BRAND_REPLACEMENTS = [
  // Noms du bot
  ['INCONNU XD V2', 'DJOUSSE-TECH-MD'],
  ['INCONNU-XD-V2', 'DJOUSSE-TECH-MD'],
  ['INCONNU-XD', 'DJOUSSE-TECH-MD'],
  ['INCONNU XD', 'DJOUSSE-TECH-MD'],
  ['inconnu xd v2', 'djousse-tech-md'],
  ['inconnu xd', 'djousse-tech-md'],
  ['inconnu boy', 'DJOUSSSE'],
  ['INCONNU BOY', 'DJOUSSSE'],
  ['inconnu', 'djousse'],
  
  // Numéro du propriétaire
  ['554488138425', '237693978044'],
  
  // Newsletter/Channel
  ['120363397722863547@newsletter', '120363397722863547@newsletter'],
  
  // Chemins d'import (N-main utilise ../../config.cjs)
  ["from '../../config.cjs'", "from '../config.cjs'"],
  ["from '../lib/myfunc.cjs'", "from '../lib/myfunc.cjs'"],
  ["from '../../lib/myfunc.cjs'", "from '../lib/myfunc.cjs'"],
  ["from '../../lib/exif.cjs'", "from '../lib/exif.cjs'"],
  ["from '../inconnu/tech.js'", "from '../lib/tech.js'"],
  ["from '../../inconnu/tech.js'", "from '../lib/tech.js'"],
  ["from '../../inconnu/generateAvatar.js'", "from '../lib/generateAvatar.js'"],
  ["from '../generateAvatar.js'", "from '../lib/generateAvatar.js'"],
];

// Fichiers à ignorer (dangereux/malveillants)
const SKIP_FILES = [
  'bug3.js', 'bug4.js', 'bug5.js',  // Attaques
  'bmenu.js',  // Menu d'attaques
  'hwaifu.js',  // NSFW
  'allvar.js',  // Expose les clés API
  'deploy.js',  // Code execution
  'update.js',  // Écrase le code
];

function convertPlugin(content, filename) {
  let converted = content;
  
  // Appliquer les conversions de marque
  for (const [search, replace] of BRAND_REPLACEMENTS) {
    converted = converted.replaceAll(search, replace);
  }
  
  // Convertir les imports ESM si nécessaire
  // N-main utilise déjà ESM, on garde le format
  converted = converted.replace(/import\s+pkg\s+from\s+'@whiskeysockets\/baileys'/g, 
    "import pkg from '@whiskeysockets/baileys'");
  
  return converted;
}

function getCommandName(content, filename) {
  // Extraire le nom de commande principal du fichier
  const match = content.match(/cmd\s*===?\s*['"](\w+)['"]/) ||
                content.match(/validCommands\s*=\s*\[([^\]]+)\]/) ||
                content.match(/['"](\w+)['"]\s*===\s*cmd/);
  
  if (match) {
    return match[1] || filename.replace('.js', '');
  }
  return filename.replace('.js', '');
}

async function main() {
  console.log('🔄 Conversion des plugins N-main → DJOUSSE-TECH-MD...\n');
  
  // Lire tous les fichiers N-main
  const files = fs.readdirSync(NMAIN_DIR).filter(f => f.endsWith('.js'));
  
  let converted = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of files) {
    // Vérifier si le fichier doit être ignoré
    if (SKIP_FILES.includes(file)) {
      console.log(`⏭️  Ignoré (dangereux): ${file}`);
      skipped++;
      continue;
    }
    
    try {
      const content = fs.readFileSync(path.join(NMAIN_DIR, file), 'utf8');
      const convertedContent = convertPlugin(content, file);
      
      // Nom du fichier de sortie
      const outputFile = file.replace('.js', '.mjs');
      const outputPath = path.join(OUTPUT_DIR, `nmain-${outputFile}`);
      
      // Écrire le fichier converti
      fs.writeFileSync(outputPath, convertedContent, 'utf8');
      
      const cmdName = getCommandName(convertedContent, file);
      console.log(`✅ ${file} → nmain-${outputFile} (cmd: .${cmdName})`);
      converted++;
      
    } catch (err) {
      console.error(`❌ Erreur avec ${file}:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Résumé:`);
  console.log(`   ✅ Convertis: ${converted}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);
  console.log(`   📁 Total: ${files.length}`);
}

main().catch(console.error);
