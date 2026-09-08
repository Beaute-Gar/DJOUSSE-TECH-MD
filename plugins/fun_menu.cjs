const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   FUN MENU — Commandes fun copiées de N-main, adaptées au format CJS
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── 8BALL ───────────────────────────────────────────────────────────────
const eightBallAnswers = [
  '✅ Oui, absolument !', '✅ C\'est certain.', '✅ Sans aucun doute.',
  '✅ Oui, je le pense.', '✅ Probablement.', '🤔 Hmm, peut-être...',
  '🤔 Je ne sais pas trop...', '🔄 Réessaie plus tard.', '❌ Non.',
  '❌ Pas du tout.', '❌ Je ne le pense pas.', '❌ Ne compte pas là-dessus.',
  '❌ C\'est non.', '⚠️ Les signes ne sont pas clairs.',
];

cmd({
  pattern: '8ball',
  react: '🎱',
  desc: 'Poser une question oui/non à la boule magique',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply('🎱 Pose une question ! Ex: .8ball Est-ce que je vais réussir ?');
  const answer = eightBallAnswers[Math.floor(Math.random() * eightBallAnswers.length)];
  await conn.sendMessage(m.chat, {
    text: box('🎱 *MAGIC 8 BALL*', [
      { label: 'Question', value: q },
      { blank: true },
      { raw: '*Réponse:* ' + answer },
    ]),
  }, { quoted: m });
});

// ─── WYR (Would You Rather) ─────────────────────────────────────────────
const wyrPairs = [
  ['Pouvoir voler 🦅', 'Être invisible 👻'],
  ['Toujours dire la vérité 🗣️', 'Toujours mentir 🤥'],
  ['Être riche 💰', 'Être célèbre ⭐'],
  ['Voyager dans le passé ⏰', 'Voyager dans le futur 🚀'],
  ['Pouvoir lire les pensées 🧠', 'Pouvoir se téléporter 🌀'],
  ['Avoir la force 💪', 'Être très intelligent 🧠'],
  ['Manger toujours sucré 🍫', 'Manger toujours salé 🧂'],
  ['Ne plus jamais dormir 😴', 'Ne plus jamais manger 🍽️'],
  ['Parler tous les langages 🌍', 'Comprendre tous les animaux 🐾'],
  ['Être le plus beau du monde 💎', 'Être le plus fort du monde 🏋️'],
];

// ─── COMPLIMENT ──────────────────────────────────────────────────────────
const compliments = [
  'Tu es incroyable et le monde est meilleur avec toi dedans. ✨',
  'Ton sourire illumine même les jours les plus gris. ☀️',
  'Tu as un cœur en or, continue comme ça. 💛',
  'Tu es la définition de la greatness. 👑',
  'Les gens ont de la chance de te connaître. 🍀',
  'Tu es plus fort que tu ne le crois. 💪',
  'Ton énergie est contagieuse, merci d\'exister. 🌟',
  'Tu es une perle rare dans ce monde. 🦪',
  'Continue de briller, le monde a besoin de ta lumière. ✨',
  'Tu es la meilleure version de toi-même, et c\'est déjà magnifique. 🌈',
];

cmd({
  pattern: 'compliment',
  react: '💛',
  desc: 'Recevoir un compliment aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const c = compliments[Math.floor(Math.random() * compliments.length)];
  await conn.sendMessage(m.chat, {
    text: box('💛 *COMPLIMENT*', [
      { blank: true },
      { raw: c },
    ]),
  }, { quoted: m });
});

// ─── PICKUP LINE ─────────────────────────────────────────────────────────
const pickupLines = [
  'Tu as une carte Google ? Parce que je me perds dans tes yeux. 🗺️',
  'Tu es fatigué(e) ? Parce que tu tournes dans ma tête depuis toute la journée. 🔄',
  'Si tu étais un ticket, tu serais le meilleur "gagnant". 🎫',
  'Est-ce que tu es un nuage ? Parce que je te vois dans tous mes rêves. ☁️',
  'Tu as un mapa ? Je crois que je me suis perdu dans tes yeux. 🧭',
  'Si la beauté était du temps, tu serais une éternité. ⏳',
  'Tu es la raison pour laquelle je souris sur mon téléphone. 📱',
  'On est tous faits d\'atomes, et toi tu es fait de 100% de perfection. ⚛️',
];

cmd({
  pattern: 'pickup',
  react: '😏',
  desc: 'Ligne de séduction aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const p = pickupLines[Math.floor(Math.random() * pickupLines.length)];
  await conn.sendMessage(m.chat, {
    text: box('😏 *PICKUP LINE*', [
      { blank: true },
      { raw: p },
    ]),
  }, { quoted: m });
});

// ─── RATE ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'rate',
  react: '📊',
  desc: 'Noter quelque chose de 0 à 10',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply('📊 Que veux-tu noter ? Ex: .rate moi');
  const rating = Math.floor(Math.random() * 11);
  const bar = '█'.repeat(rating) + '░'.repeat(10 - rating);
  await conn.sendMessage(m.chat, {
    text: box('📊 *RATE*', [
      { label: 'Sujet', value: q },
      { label: 'Note', value: rating + '/10' },
      { raw: '`' + bar + '`' },
    ]),
  }, { quoted: m });
});

// ─── SHIP ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'ship',
  react: '💕',
  desc: 'Calculer la compatibilité amoureuse',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  const names = q ? q.split(/[&+et]/i).map(n => n.trim()).filter(Boolean) : [m.pushName || 'User', 'Quelqu\'un'];
  if (names.length < 2) return reply('💕 Utilisation: .ship Alice & Bob');
  const pct = Math.floor(Math.random() * 101);
  const hearts = '❤️'.repeat(Math.min(Math.floor(pct / 10), 10));
  const verdict = pct > 80 ? '💕 Destinés l\'un à l\'autre !' : pct > 50 ? '💛 Ça peut le faire !' : pct > 20 ? '🧡 Bof...' : '💔 Oublie-les.';
  await conn.sendMessage(m.chat, {
    text: box('💕 *LOVE CALCULATOR*', [
      { label: 'Couple', value: names[0] + ' & ' + names[1] },
      { label: 'Score', value: pct + '%' },
      { raw: hearts },
      { raw: verdict },
    ]),
  }, { quoted: m });
});

// ─── INSULT ──────────────────────────────────────────────────────────────
const insultList = [
  '🧠 Ton cerveau a fui par honte.',
  '🕳️ Tu es la preuve que l\'univers a des bugs.',
  '📟 Ton QIQ a retourné une erreur 404.',
  '🔌 Tu n\'es pas bête. Tu es juste en mode avion en permanence.',
  '💾 Tu es un logiciel obsolète sur un disque corrompu.',
  '🥴 Si la bêtise était un sport, tu aurais une médaille d\'or.',
  '🪞 Ton reflet se cache probablement de honte.',
  '🎭 Tu portes ton ego comme une cape de super-héros... malheureusement, elle est invisible.',
  '☢️ Tu es comme une erreur nucléaire : rare, dangereuse et totalement inutile.',
  '🎮 Tu es le lag du jeu multijoueur de la vie.',
  '🕷️ Même les araignées évitent ta toile de conneries.',
  '📉 Tu es la raison pour laquelle le groupe est devenu silencieux.',
  '🌪️ Tu es une tornade de mauvaises décisions.',
  '🧩 Tu es un puzzle de la mauvaise boîte.',
  '🚽 Même les toilettes se sont rincées pour t\'éviter.',
  '📼 Tes pensées tournent en VHS dans un monde numérique.',
];

cmd({
  pattern: 'insult',
  react: '🔥',
  desc: 'Insulte aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.sender || m.sender;
  const name = target.split('@')[0];
  const insult = insultList[Math.floor(Math.random() * insultList.length)];
  const text = box('🔥 *INSULT*', [
    { label: 'Cible', value: '@' + name },
    { blank: true },
    { raw: insult },
  ]);
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});

// ─── ROAST ───────────────────────────────────────────────────────────────
const roastList = [
  'Tu n\'es pas bête ; tu as juste la malchance de réfléchir.',
  'Tu es comme un nuage. Quand tu disparais, c\'est une belle journée.',
  'Tu apportes tellement de joie... quand tu quittes la pièce.',
  'Tu n\'es pas la personne la plus stupide au monde, mais j\'espère qu\'ils ne mourront pas.',
  'Tes secrets sont toujours en sécurité avec moi. Je ne t\'écoute même pas.',
  'Tu es la preuve que même l\'évolution fait une pause.',
  'Tu es comme une mise à jour logicielle. Quand je te vois, je pense "pas maintenant".',
  'Ton visage fait pleurer les oignons.',
  'Tu es si faux que Barbie est jalouse.',
  'Tu es inutile comme le "g" dans lasagne.',
  'Tu es comme un interrupteur — toujours éteint.',
  'Tu es aussi sharp qu\'une bille.',
  'Tu es la version humaine d\'un prix de participation.',
  'Tu es aussi utile qu\'une écran sur un sous-marin.',
  'Tu es comme un crayon cassé — sans point.',
  'Tu es la raison pour laquelle les shampoings ont des instructions.',
  'Tu es le genre de personnes qui trébuchent sur une connexion sans fil.',
  'Tu es la version humaine d\'une faute de frappe.',
  'Tu n\'es pas complètement inutile — tu peux servir de mauvais exemple.',
  'Tu es comme un téléphone sans signal — perdu et inutile.',
];

cmd({
  pattern: 'roast',
  react: '🔥',
  desc: 'Roast aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.sender || m.sender;
  const name = target.split('@')[0];
  const roast = roastList[Math.floor(Math.random() * roastList.length)];
  const text = box('🔥 *ROAST*', [
    { label: 'Cible', value: '@' + name },
    { blank: true },
    { raw: roast },
  ]);
  await conn.sendMessage(m.chat, { text, mentions: [target] }, { quoted: m });
});

// ─── TRUTH ───────────────────────────────────────────────────────────────
const truths = [
  'Quel est ton plus grand secret que personne ne connaît ?',
  'As-tu déjà menti à quelqu\'un que tu aimes ?',
  'Quelle est ta plus grande peur ?',
  'As-tu déjà triché à un jeu ?',
  'Quel est ton regrets le plus grand ?',
  'As-tu déjà dit quelque chose de méchant sur quelqu\'un dans son dos ?',
  'Quelle est la chose la plus embarrassante que tu aies faite ?',
  'As-tu déjà embrassé quelqu\'un par pitié ?',
  'Quel est ton fantasme le plus fou ?',
  'As-tu déjà volé quelque chose ?',
];

cmd({
  pattern: 'truth',
  react: '🤥',
  desc: 'Question vérité aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const t = truths[Math.floor(Math.random() * truths.length)];
  await conn.sendMessage(m.chat, {
    text: box('🤥 *VÉRITÉ*', [
      { blank: true },
      { raw: t },
      { blank: true },
      { raw: '_Réponds honnêtement... ou pas 🤫_' },
    ]),
  }, { quoted: m });
});
