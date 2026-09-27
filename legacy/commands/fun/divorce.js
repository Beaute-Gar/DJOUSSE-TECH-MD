const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'divorce',
  desc: 'Divorce your married partner',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const sender = m.sender.split('@')[0];
  const percentage = Math.floor(Math.random() * 101);
  const messages = [
    `🤖 [SYSTEM] Protocole de divorce initialisé pour ${sender}...`,
    `⚡ [ROBOT] Scan de rupture en cours...`,
    `💔 [SYSTEM] Analyse des biens numériques...`,
    `🤖 [ROBOT] Calcul de la compensation émotionnelle...`
  ];

  let text = messages[Math.floor(Math.random() * messages.length)] + '\n\n';

  const results = [
    `📊 Résultat : Divorce finalisé.\n💰 Compensation : ${percentage} € virtuels.\n📝 Statut : LIBRE.\n\n⚡ [ROBOT] ${sender} est maintenant célibataire.`,
    `📊 Résultat : Divorce raté.\n💔 Les données sentimentales sont bloquées.\n📝 Statut : EN LITIGE.\n\n⚡ [ROBOT] Procédure en cours...`,
    `📊 Résultat : Divorce accepté.\n🏠 Partage des données : 50/50.\n📝 Statut : SÉPARÉS.\n\n⚡ [ROBOT] Protocole terminé.`,
    `📊 Résultat : Divorce annulé.\n🤖 Système détecte des regrets.\n📝 Statut : EN RÉFLEXION.\n\n⚡ [ROBOT] Réessayez plus tard.`
  ];

  text += results[Math.floor(Math.random() * results.length)];
  await m.reply(boxWithFooter('💔 DIVORCE', [{ raw: text }]));
});
