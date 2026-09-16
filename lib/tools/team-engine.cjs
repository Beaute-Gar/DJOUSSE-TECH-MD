'use strict';

const EXPERTS = [
  { emoji: '🎯', titre: 'Chef de Projet', role: 'Coordination et planification' },
  { emoji: '📊', titre: 'Analyste', role: 'Analyse des données et besoins' },
  { emoji: '🧠', titre: 'Stratège', role: 'Vision à long terme et optimisation' },
  { emoji: '⚡', titre: 'Exécuteur', role: 'Mise en œuvre rapide et efficace' },
  { emoji: '✅', titre: 'QA / Validateur', role: 'Contrôle qualité et validation' }
];

const EXPERTS_PEDA = [
  { emoji: '👨‍🏫', titre: 'Enseignant', role: 'Pédagogie et vulgarisation' },
  { emoji: '📝', titre: 'Correcteur', role: 'Vérification et reformulation' }
];

function isPedagogique(goal) {
  return /(cours|chapitre|fiche|révision|revision|exercice|élèves|eleves|leçon|lesson|enseigner|comprendre|bachelier|bac\b|programme officiel|apprendre|explique)/i.test(goal);
}

async function runTeam(goal) {
  const team = isPedagogique(goal) ? EXPERTS_PEDA : EXPERTS;
  let report = `👥 *Équipe de ${team.length} experts*\n\n`;
  report += `📋 *Objectif:* ${goal}\n\n`;
  for (const e of team) {
    report += `${e.emoji} *${e.titre}* — ${e.role}\n`;
  }
  report += `\n---\n\n`;
  report += `🤝 *Collaboration:* Les experts ont analysé l'objectif.\n\n`;
  report += `💡 _Pour des résultats plus élaborés, configurez une clé GROQ_API_KEY dans .env._`;

  return { report, team };
}

module.exports = { runTeam };
