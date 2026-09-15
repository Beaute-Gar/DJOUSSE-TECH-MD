const { cmd } = require('../command.cjs');

const characters = [
  { trait: 'Leadership naturel', desc: 'Vous inspirez les autres naturellement.' },
  { trait: 'Créativité débordante', desc: 'Vos idées sont toujours innovantes.' },
  { trait: 'Résilience', desc: 'Vous surmontez tous les obstacles.' },
  { trait: 'Empathie', desc: 'Vous comprenez les sentiments des autres.' },
  { trait: 'Curiosité insatiable', desc: 'Vous voulez tout apprendre.' },
  { trait: 'Humour naturel', desc: 'Vous rendez les gens heureux.' },
  { trait: 'Patience', desc: 'Vous savez attendre le bon moment.' },
  { trait: 'Détermination', desc: 'Vous n\'abandonnez jamais.' },
  { trait: 'Générosité', desc: 'Vous donnez sans attendre en retour.' },
  { trait: 'Intelligence', desc: 'Vous résolvez les problèmes facilement.' },
  { trait: 'Courage', desc: 'Vous affrontez vos peurs.' },
  { trait: 'Honnêteté', desc: 'Vous êtes toujours sincère.' },
  { trait: 'Optimisme', desc: 'Vous voyez le bon côté des choses.' },
  { trait: 'Modestie', desc: 'Vous restez humble malgré vos succès.' },
  { trait: 'Spontanéité', desc: 'Vous surprenez toujours les gens.' }
];

cmd({
  pattern: 'character',
  alias: ['caractère', 'trait'],
  desc: 'Random character trait',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const char = characters[Math.floor(Math.random() * characters.length)];
  const text = `🧬 [ROBOT] TRAIT DE CARACTÈRE!\n\n✨ Trait: ${char.trait}\n💬 ${char.desc}\n\n⚡ [ROBOT] Trait sélectionné par algorithme de personnalité.`;
  await m.reply(text);
});
