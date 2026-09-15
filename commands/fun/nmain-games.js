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
const loveImage = 'https://files.catbox.moe/e1k73u.jpg';

cmd({
  pattern: 'love',
  react: '❤️',
  desc: 'Message d\'amour aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const caption = box('❤️ *A Little Love* ❤️', [
    { blank: true },
    { raw: 'Hey *' + name + '*,Here\'s some warmth 💕' },
    { raw: 'to brighten your day!' },
    { blank: true },
    { raw: 'Stay amazing! ✨' },
  ]);
  await conn.sendMessage(from, { image: { url: loveImage }, caption }, { quoted: m });
});

cmd({
  pattern: 'goodmorning',
  react: '☀️',
  desc: 'Bonjour aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const caption = box('☀️ *Good Morning!* ☀️', [
    { blank: true },
    { raw: 'Rise and shine, *' + name + '*!' },
    { raw: 'May your day be filled with joy and good vibes!' },
    { blank: true },
    { raw: 'Have a wonderful day!' },
  ]);
  await conn.sendMessage(from, { image: { url: loveImage }, caption }, { quoted: m });
});

cmd({
  pattern: 'goodnight',
  react: '🌙',
  desc: 'Bonne nuit aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const name = m.pushName || 'User';
  const caption = box('🌙 *Good Night* 🌙', [
    { blank: true },
    { raw: 'Sweet dreams, *' + name + '*!' },
    { raw: 'May your sleep be calm and your rest peaceful.' },
    { blank: true },
    { raw: 'See you tomorrow! ✨' },
  ]);
  await conn.sendMessage(from, { image: { url: loveImage }, caption }, { quoted: m });
});

// ─── QUIZ ────────────────────────────────────────────────────────────────
const quizSessions = new Map();

function decodeHTML(str) {
  return str.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

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
