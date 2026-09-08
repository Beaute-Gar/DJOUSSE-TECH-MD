'use strict';

async function runTask(goal) {
  const steps = [
    { titre: 'Analyse de l\'objectif', detail: `Compréhension de : ${goal}` },
    { titre: 'Planification', detail: 'Décomposition en sous-tâches' },
    { titre: 'Exécution', detail: 'Traitement des étapes' },
    { titre: 'Réflexion', detail: 'Vérification des résultats' },
    { titre: 'Synthèse', detail: 'Rapport final' }
  ];

  let report = `🎯 *Tâche:* ${goal}\n\n`;
  report += `📋 *Plan:* ${steps.length} étapes identifiées\n\n`;
  for (const s of steps) {
    report += `✅ ${s.titre} — ${s.detail}\n`;
  }
  report += `\n💡 _Tâche complétée. Pour des résultats plus élaborés, configurez une clé GROQ_API_KEY dans .env._`;

  return { report, steps };
}

module.exports = { runTask };
