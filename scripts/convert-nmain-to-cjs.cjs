/**
 * Script de conversion N-main plugins (ESM .mjs) → CJS (.cjs)
 * Convertit les plugins ESM en plugins CJS compatibles avec le système cmd()
 * 
 * Usage: node scripts/convert-nmain-to-cjs.cjs
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const backupDir = path.join(__dirname, '..', 'plugins-backup-nmain-' + Date.now());
const logFile = path.join(__dirname, '..', 'conversion-log.txt');

let converted = 0;
let failed = 0;
let skipped = 0;
const logs = [];

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

function saveLog() {
  fs.writeFileSync(logFile, logs.join('\n'), 'utf8');
  console.log(`\n📝 Log sauvegardé: ${logFile}`);
}

function getPluginName(file) {
  return file.replace('.mjs', '').replace('nmain-', '');
}

function convertImport(importStmt) {
  // import config from '../config.cjs' → const config = require('../config.cjs');
  let converted = importStmt
    .replace(/^import\s+/, 'const ')
    .replace(/\s+from\s+/, ' = require(')
    .replace(/;$/, ');');
  
  // import { something } from 'module' → const { something } = require('module');
  if (importStmt.includes('{')) {
    converted = importStmt
      .replace(/^import\s+/, 'const ')
      .replace(/\s+from\s+/, ' = require(')
      .replace(/;$/, ');');
  }
  
  // import * as name from 'module' → const name = require('module');
  if (importStmt.includes('* as')) {
    converted = importStmt
      .replace(/^import\s+/, 'const ')
      .replace(/\s+from\s+/, ' = require(')
      .replace(/;$/, ');');
  }
  
  // Remove 'type' keyword if present
  converted = converted.replace(/\btype\s+/g, '');
  
  return converted;
}

function convertPlugin(content, filename) {
  const lines = content.split('\n');
  const newLines = [];
  const imports = [];
  const functionLines = [];
  let inImport = false;
  let braceCount = 0;
  let isInFunction = false;
  let functionName = null;
  let foundExport = false;
  let foundReactions = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip __filename and __dirname lines (ESM specific)
    if (trimmed.includes('fileURLToPath') || trimmed.includes('__dirname = path.dirname')) {
      continue;
    }
    
    // Skip import.meta.url
    if (trimmed.includes('import.meta.url')) {
      continue;
    }
    
    // Convert import statements
    if (trimmed.startsWith('import ') && !trimmed.startsWith('import(')) {
      // Handle default import: import config from '...'
      const defaultMatch = trimmed.match(/^import\s+(\w+)\s+from\s+['"](.+)['"]/);
      if (defaultMatch) {
        imports.push(`const ${defaultMatch[1]} = require('${defaultMatch[2]}');`);
        continue;
      }
      
      // Handle named import: import { x, y } from '...'
      const namedMatch = trimmed.match(/^import\s+\{([^}]+)\}\s+from\s+['"](.+)['"]/);
      if (namedMatch) {
        imports.push(`const { ${namedMatch[1]} } = require('${namedMatch[2]}');`);
        continue;
      }
      
      // Handle namespace import: import * as name from '...'
      const nsMatch = trimmed.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"](.+)['"]/);
      if (nsMatch) {
        imports.push(`const ${nsMatch[1]} = require('${nsMatch[2]}');`);
        continue;
      }
      
      // Skip other imports (side-effect only imports)
      continue;
    }
    
    // Convert export default
    if (trimmed === 'export default menu;' || trimmed === 'export default menu') {
      foundExport = true;
      // Don't add export default, we'll use cmd() wrapper
      continue;
    }
    
    // Find the main function
    const funcMatch = trimmed.match(/^(async\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/);
    if (funcMatch && !functionName) {
      functionName = funcMatch[2];
      isInFunction = true;
    }
    
    // Add opening brace tracking
    if (trimmed.includes('{')) braceCount++;
    if (trimmed.includes('}')) braceCount--;
    
    functionLines.push(line);
  }
  
  if (!functionName) {
    functionName = 'handler';
  }
  
  // Build the converted plugin
  newLines.push('/* eslint-disable */');
  newLines.push(`/* Converti depuis N-main: ${filename} */`);
  newLines.push(`/* Plugin converti automatiquement — ${new Date().toISOString()} */`);
  newLines.push('');
  newLines.push('const { cmd } = require(\'../command.cjs\');');
  newLines.push('const config = require(\'../config.cjs\');');
  newLines.push('');
  
  // Add necessary requires based on the code
  const allCode = functionLines.join('\n');
  
  // Add fs/promises if used
  if (allCode.includes('readFile') || allCode.includes('writeFile') || allCode.includes('unlink')) {
    newLines.push('const fsPromises = require(\'fs\').promises;');
  }
  if (allCode.includes('fs.existsSync') || allCode.includes('fs.readdirSync')) {
    newLines.push('const fs = require(\'fs\');');
  }
  if (allCode.includes('path.join') || allCode.includes('path.dirname')) {
    newLines.push('const path = require(\'path\');');
  }
  if (allCode.includes('os.')) {
    newLines.push('const os = require(\'os\');');
  }
  if (allCode.includes('crypto.')) {
    newLines.push('const crypto = require(\'crypto\');');
  }
  
  newLines.push('');
  
  // Add function code
  newLines.push(...functionLines.filter(l => 
    !l.includes('export default') && 
    !l.includes('import ') &&
    !l.includes('fileURLToPath') &&
    !l.includes('import.meta.url')
  ));
  
  newLines.push('');
  
  // Add cmd() wrapper
  newLines.push(`cmd({`);
  newLines.push(`  pattern: '${functionName.replace('Handler', '').toLowerCase()}',`);
  newLines.push(`  desc: 'Plugin N-main converti: ${functionName}',`);
  newLines.push(`  category: 'converted',`);
  newLines.push(`  filename: __filename,`);
  newLines.push(`}, async (conn, m) => {`);
  newLines.push(`  const sock = conn;`);
  newLines.push(`  await ${functionName}(m, sock);`);
  newLines.push(`});`);
  
  return newLines.join('\n');
}

function processPlugin(file) {
  const filepath = path.join(pluginsDir, file);
  const pluginName = getPluginName(file);
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Check if it's a valid N-main plugin
    if (!content.includes('export default')) {
      log(`⏭️  SKIP ${file} — pas un plugin N-main (pas d'export default)`);
      skipped++;
      return;
    }
    
    // Convert to CJS
    const converted = convertPlugin(content, file);
    
    // Write converted plugin
    const newFilename = file.replace('.mjs', '.cjs');
    const newFilepath = path.join(pluginsDir, newFilename);
    fs.writeFileSync(newFilepath, converted, 'utf8');
    
    // Rename original to .bak
    fs.renameSync(filepath, filepath + '.bak');
    
    log(`✅ CONVERTED ${file} → ${newFilename}`);
    converted++;
    
  } catch (err) {
    log(`❌ FAILED ${file}: ${err.message}`);
    failed++;
  }
}

function start() {
  log('═══════════════════════════════════════════════════════════════');
  log('  N-main Plugin Converter — ESM → CJS');
  log('  ' + new Date().toISOString());
  log('═══════════════════════════════════════════════════════════════\n');
  
  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });
  log(`📁 Backup dir: ${backupDir}\n`);
  
  // Get all N-main .mjs files
  const files = fs.readdirSync(pluginsDir)
    .filter(f => f.startsWith('nmain-') && f.endsWith('.mjs'));
  
  log(`Found ${files.length} N-main plugins to convert\n`);
  
  // Process each file
  for (const file of files) {
    processPlugin(file);
  }
  
  // Summary
  log('\n═══════════════════════════════════════════════════════════════');
  log('  CONVERSION SUMMARY');
  log('═══════════════════════════════════════════════════════════════');
  log(`  ✅ Converted: ${converted}`);
  log(`  ⏭️  Skipped: ${skipped}`);
  log(`  ❌ Failed: ${failed}`);
  log(`  📁 Backup: ${backupDir}`);
  log('═══════════════════════════════════════════════════════════════');
  
  saveLog();
  
  if (converted > 0) {
    log('\n🚀 Restart the bot to load converted plugins!');
    log('💡 To restore originals: mv plugins/*.mjs.bak plugins/*.mjs');
  }
}

start();
