
'use strict';

const fs = require('fs');

const indexPath = 'index.js';
const stylePath = 'style.js';

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label} : une occurrence attendue, ${count} trouvée.`
    );
  }

  return source.replace(oldText, newText);
}

function main() {
  if (!fs.existsSync(indexPath) || !fs.existsSync(stylePath)) {
    throw new Error('Lance ce script depuis le dossier du bot.');
  }

  const originalIndex = fs.readFileSync(indexPath, 'utf8');
  const originalStyle = fs.readFileSync(stylePath, 'utf8');

  let updatedIndex = replaceOnce(
    originalIndex,
    '  if (changed && startupDashboardShown) showStartupDashboard();',
    [
      '  if (changed && startupDashboardShown) {',
      "    rawLog(`[STATUS] WhatsApp : ${status}${lastError ? ` — ${lastError}` : ''}`);",
      '  }'
    ].join('\n'),
    'Statut WhatsApp'
  );

  let updatedStyle = replaceOnce(
    originalStyle,
    'const boxRow = text => `â•‘${String(text).padEnd(BOX_W)}â•‘`;',
    [
      'const boxRow = text => {',
      '  const content = [...String(text)].slice(0, BOX_W - 2).join("");',
      '  return `â•‘ ${content.padEnd(BOX_W - 2)} â•‘`;',
      '};'
    ].join('\n'),
    'Bordures du tableau'
  );

  // Vérifier les deux modifications avant toute écriture.
  if (updatedIndex === originalIndex || updatedStyle === originalStyle) {
    throw new Error('Aucune modification complète détectée.');
  }

  // Écrire uniquement après validation des deux remplacements.
  fs.writeFileSync(indexPath, updatedIndex, 'utf8');
  fs.writeFileSync(stylePath, updatedStyle, 'utf8');

  console.log('Correctif appliqué.');
  console.log('- Le tableau de bord ne sera plus réimprimé à chaque changement de statut.');
  console.log('- Les statuts seront affichés sur des lignes séparées.');
  console.log('- Les lignes du cadre auront une largeur intérieure uniforme.');
}

try {
  main();
} catch (error) {
  console.error('CORRECTIF NON APPLIQUÉ : ' + error.message);
  process.exitCode = 1;
}
