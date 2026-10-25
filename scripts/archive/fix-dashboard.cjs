
'use strict';

const fs = require('fs');

const indexPath = 'index.js';
const stylePath = 'style.js';

function replaceExactly(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label} : texte attendu une seule fois, trouvé ${count} fois. Aucun changement effectué pour ce remplacement.`
    );
  }

  return source.replace(oldText, newText);
}

function main() {
  if (!fs.existsSync(indexPath) || !fs.existsSync(stylePath)) {
    throw new Error('index.js ou style.js est introuvable. Lance ce script depuis le dossier du bot.');
  }

  const indexOriginal = fs.readFileSync(indexPath, 'utf8');
  const styleOriginal = fs.readFileSync(stylePath, 'utf8');

  let indexUpdated = indexOriginal;
  let styleUpdated = styleOriginal;

  indexUpdated = replaceExactly(
    indexUpdated,
    '  if (changed && startupDashboardShown) showStartupDashboard();',
    [
      '  if (changed && startupDashboardShown) {',
      "    rawLog(`[STATUS] WhatsApp : ${status}${lastError ? ` — ${lastError}` : ''}`);",
      '  }'
    ].join('\n'),
    'Actualisation du statut'
  );

  styleUpdated = replaceExactly(
    styleUpdated,
    "const boxRow = (text) => `║${String(text).padEnd(BOX_W)}║`;",
    [
      'const boxRow = (text) => {',
      '  const content = [...String(text)].slice(0, BOX_W - 2).join("");',
      '  return `║ ${content.padEnd(BOX_W - 2)} ║`;',
      '};'
    ].join('\n'),
    'Alignement des bordures'
  );

  // Vérifier les changements avant d'écrire.
  if (indexUpdated === indexOriginal || styleUpdated === styleOriginal) {
    throw new Error('Aucun changement complet détecté. Les fichiers n’ont pas été modifiés.');
  }

  fs.writeFileSync(indexPath, indexUpdated, 'utf8');
  fs.writeFileSync(stylePath, styleUpdated, 'utf8');

  console.log('Correctif appliqué :');
  console.log('- Le tableau de bord ne sera plus réimprimé à chaque changement de connexion.');
  console.log('- Les changements de statut seront affichés en lignes courtes.');
  console.log('- Les lignes du cadre auront une marge intérieure et une largeur uniforme.');
  console.log('Les sauvegardes .backup sont conservées.');
}

try {
  main();
} catch (error) {
  console.error('CORRECTIF NON APPLIQUÉ :', error.message);
  process.exitCode = 1;
}
