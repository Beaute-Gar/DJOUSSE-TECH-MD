const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   JEUX — Dare, Quiz, Tic-Tac-Toe, Love — adaptés de N-main
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── DARE ────────────────────────────────────────────────────────────────
const dares = [
  '💌 Dis-moi un secret que tu n\'as jamais raconté.',
  '😘 Envoie un selfie mignon avec un bisou.',
  '💍 Fais-moi une déclaration comme si c\'était vrai.',
  '🎵 Dédie-moi une chanson romantique maintenant.',
  '💬 Écris "je t\'aime" de 3 façons différentes.',
  '📱 Partage la dernière photo de ta galerie.',
  '🫂 Décris comment tu me ferais un câlin.',
  '🛏️ Décris ta soirée de rêve avec moi.',
  '👀 Envoie-moi un vocal "tu me manques".',
  '🎭 Fais semblant d\'être fâché pendant 30 secondes.',
  '👄 Envoie un combo d\'émojis bisou.',
  '❤️ Dis ce que tu aimes le plus chez moi.',
  '📝 Écris un poème romantique de 3 lignes.',
  '🥺 Dis quelque chose de doux pour me faire rougir.',
  '👫 Utilise un émoji pour représenter notre relation.',
  '⏰ Mets mon nom en statut pendant 1 heure.',
  '📸 Recrée un de mes selfies et envoie-le.',
  '📞 Appelle-moi par un surnom mignon.',
  '🌹 Envoie une rose virtuelle avec un message.',
  '🎲 Décris ton fantasme le plus fou avec moi.',
];

cmd({
  pattern: 'dare',
  react: '🎲',
  desc: 'Défi aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const dare = dares[Math.floor(Math.random() * dares.length)];
  const text = box('🎲 *DARE — DÉFI*', [
    { blank: true },
    { raw: dare },
    { blank: true },
    { raw: '_Fais-le maintenant ou tu as peur 😏_' },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

// ─── LOVE ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'love',
  react: '❤️',
  desc: 'Message d\'amour aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const text = box('❤️ *LOVE*', [
    { blank: true },
    { raw: 'Hey *' + name + '*, voici un peu de chaleur 💕' },
    { raw: 'pour illuminer ta journée !' },
    { blank: true },
    { raw: 'Reste incroyable ! ✨' },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

cmd({
  pattern: 'goodmorning',
  react: '☀️',
  desc: 'Bonjour aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const text = box('☀️ *BONJOUR!*', [
    { blank: true },
    { raw: 'Lève-toi et brille, *' + name + '* !' },
    { raw: 'Que ta journée soit remplie' },
    { raw: 'de joie et de bonnes vibes !' },
    { blank: true },
    { raw: 'Passe une merveilleuse journée ! ✨' },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

cmd({
  pattern: 'goodnight',
  react: '🌙',
  desc: 'Bonne nuit aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const text = box('🌙 *BONNE NUIT*', [
    { blank: true },
    { raw: 'Douce nuit, *' + name + '* !' },
    { raw: 'Que ton sommeil soit calme' },
    { raw: 'et ton repos paisible.' },
    { blank: true },
    { raw: 'À demain ! ✨' },
  ]);
  await conn.sendMessage(from, { text }, { quoted: m });
});

// ─── QUIZ ────────────────────────────────────────────────────────────────
const quizSessions = new Map();

function decodeHTML(str) {
  return str.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

cmd({
  pattern: 'quiz',
  alias: ['trivia'],
  react: '🧠',
  desc: 'Quiz aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (quizSessions.has(from)) return reply('⏳ Tu as déjà un quiz en cours. Réponds-le d\'abord !');
  try {
    const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await res.json();
    if (!data.results || !data.results.length) return reply('❌ Quiz indisponible.');

    const q = data.results[0];
    const allAnswers = [...q.incorrect_answers, q.correct_answer];
    const shuffled = allAnswers.sort(() => Math.random() - 0.5);
    const correctIndex = shuffled.indexOf(q.correct_answer);
    const difficulty = q.difficulty.toLowerCase();
    const points = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15;

    const options = shuffled.map((a, i) => (i + 1) + '. ' + decodeHTML(a)).join('\n');
    const text = box('🧠 *QUIZ TIME*', [
      { label: 'Catégorie', value: q.category },
      { label: 'Difficulté', value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) },
      { label: 'Points', value: String(points) },
      { blank: true },
      { raw: '*Question:* ' + decodeHTML(q.question) },
      { blank: true },
      { raw: options },
      { blank: true },
      { raw: '_Réponds avec le numéro (1-4)_\n_Tu as 30 secondes_' },
    ]);

    await conn.sendMessage(from, { text }, { quoted: m });

    quizSessions.set(from, {
      answer: correctIndex + 1,
      points,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      if (quizSessions.has(from)) {
        reply('⏰ Temps écoulé ! La bonne réponse était: ' + decodeHTML(q.correct_answer));
        quizSessions.delete(from);
      }
    }, 30000);
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TIC-TAC-TOE ────────────────────────────────────────────────────────
const tttGames = {};

function drawBoard(board) {
  return '\n   ' + board[0] + '  •  ' + board[1] + '  •  ' + board[2] +
    '\n   ———————————' +
    '\n   ' + board[3] + '  •  ' + board[4] + '  •  ' + board[5] +
    '\n   ———————————' +
    '\n   ' + board[6] + '  •  ' + board[7] + '  •  ' + board[8] + '\n';
}

function checkWinner(b) {
  const patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a, b_, c] of patterns) {
    if (b[a] === b[b_] && b[b_] === b[c] && b[a] !== '❌' && b[a] !== '⭕') return null;
    if (b[a] === b[b_] && b[b_] === b[c]) return b[a];
  }
  return null;
}

cmd({
  pattern: 'ttt',
  react: '🎮',
  desc: 'Tic-Tac-Toe en groupe',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (!tttGames[from]) {
    tttGames[from] = { playerX: m.sender, playerO: null, board: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'], turn: 'X' };
    return reply('🎮 *Tic-Tac-Toe créé !*\n🕹️ *' + m.sender.split('@')[0] + '* a lancé la partie.\nTape .ttt pour rejoindre !');
  }

  const game = tttGames[from];
  if (!game.playerO && m.sender !== game.playerX) {
    game.playerO = m.sender;
    return reply('✅ *Partie lancée !*\n' + drawBoard(game.board) + '\n❌ *' + game.playerX.split('@')[0] + '* vs ⭕ *' + game.playerO.split('@')[0] + '*\n\n🔥 C\'est à *' + game.playerX.split('@')[0] + '* (❌) !');
  }

  if (!game.playerO) return reply('⚠️ En attente d\'un second joueur...');
  return reply('⚠️ Partie déjà en cours. Attends ton tour.');
});

cmd({
  pattern: 'resetgame',
  react: '♻️',
  desc: 'Réinitialiser le Tic-Tac-Toe',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (tttGames[from]) {
    delete tttGames[from];
    return reply('♻️ *Partie réinitialisée !*');
  }
  return reply('❌ Aucune partie en cours.');
});
