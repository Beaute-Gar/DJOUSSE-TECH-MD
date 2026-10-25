
'use strict';

const fs = require('fs');

const indexPath = 'index.js';
const stylePath = 'style.js';

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label} : ${count} occurrence(s) trouvée(s), 1 attendue.`);
  }
  return source.replace(oldText, newText);
}

function main() {
  const indexOriginal = fs.readFileSync(indexPath, 'utf8');
  const styleOriginal = fs.readFileSync(stylePath, 'utf8');

  const indexUpdated = replaceOnce(
    indexOriginal,
    '  if (changed && startupDashboardShown) showStartupDashboard();',
    [
      '  if (changed && startupDashboardShown) {',
      "    rawLog(`[STATUS] WhatsApp : ${status}${lastError ? ` — ${lastError}` : ''}`);",
      '  }'
    ].join('\n'),
    'Statut WhatsApp'
  );

  // Repérer la définition de boxRow sans dépendre des caractères de bordure.
  const rowPattern = /^const boxRow\s*=\s*text\s*=>\s*`.*`;\s*$/m;
  const matches = styleOriginal.match(rowPattern);

  if (!matches || matches.length !== 1) {
    throw new Error('Définition de boxRow introuvable ou ambiguë. Aucun fichier modifié.');
  }

  const newRow = [
    'const boxRow = text => {',
    '  const content = [...String(text)].slice(0, BOX_W - 2).join("");',
    '  return `║ ${content.padEnd(BOX_W - 2)} ║`;',
    '};'
  ].join('\n');

  const styleUpdated = styleOriginal.replace(rowPattern, newRow);

  // Valider les deux changements avant d'écrire.
  if (indexUpdated === indexOriginal || styleUpdated === styleOriginal) {
    throw new Error('Un changement attendu est absent. Aucun fichier modifié.');
  }

  fs.writeFileSync(indexPath, indexUpdated, 'utf8');
  fs.writeFileSync(stylePath, styleUpdated, 'utf8');

  console.log('Correctif appliqué.');
}

try {
  main();
} catch (error) {
  console.error('CORRECTIF NON APPLIQUÉ : ' + error.message);
  process.exitCode = 1;
}
