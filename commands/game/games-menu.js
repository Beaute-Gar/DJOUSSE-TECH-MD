'use strict';

const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

// ─── États isolés par compte + chat ────────────────────────────────────────
const mathQuizState = new Map();    // `${botNum}:${chat}` → { answer, timestamp }
const triviaState = new Map();      // `${botNum}:${chat}` → { answer, opts, timestamp }
const connect4Games = new Map();    // `${botNum}:${chat}` → game state

// ─── Helpers ───────────────────────────────────────────────────────────────
function safeMath(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    default: return NaN;
  }
}

const EMPTY = '⚪';
const RED = '🔴';
const YELLOW = '🟡';

function createBoard() { return Array(6).fill(null).map(() => Array(7).fill(EMPTY)); }
function drawBoard4(board) { return board.map(row => row.join('')).join('\n'); }

function checkWin4(board, color) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (board[r][c] !== color) continue;
    for (const [dr, dc] of dirs) {
      let count = 0;
      for (let i = 0; i < 4; i++) {
        const nr = r + dr*i, nc = c + dc*i;
        if (nr<0||nr>=6||nc<0||nc>=7||board[nr][nc]!==color) break;
        count++;
      }
      if (count === 4) return true;
    }
  }
  return false;
}

// ─── MATH QUIZ ────────────────────────────────────────────────────────────
cmd({
  pattern: 'math',
  react: '🧮',
  desc: 'Quiz mathématique rapide',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = safeMath(a, op, b);
  const key = `${m.botNumber || 'default'}:${m.chat}`;
  mathQuizState.set(key, { answer, timestamp: Date.now() });
  await reply(`${a} ${op} ${b} = ?`);
});

// ─── WHOAMI ───────────────────────────────────────────────────────────────
cmd({
  pattern: 'whoami',
  react: '👤',
  desc: 'Qui suis-je ? (devinette)',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const facts = [
    'Tu es quelqu\'un de spécial. Ne l\'oublie jamais.',
    'Tu es la meilleure version de toi-même.',
    'Tu es plus fort que tu ne le crois.',
    'Tu es capable de grandes choses.',
    'Tu es unique en ton genre.',
    'Tu es une étoile dans la vie des autres.',
    'Tu es la raison pour laquelle quelqu\'un sourit aujourd\'hui.',
    'Tu es la preuve que la gentillesse existe.',
  ];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  await reply(fact);
});

// ─── SPEED TEST ───────────────────────────────────────────────────────────
cmd({
  pattern: 'speed',
  react: '⚡',
  desc: 'Tester la vitesse de réponse',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const start = Date.now();
  await m.react('⚡').catch(() => {});
  const end = Date.now();
  const speed = end - start;
  const status = speed < 200 ? 'ultra rapide' : speed < 500 ? 'rapide' : 'lent';
  await reply(`Temps de réponse : ${speed}ms — ${status}`);
});

// ─── CHOOSE ───────────────────────────────────────────────────────────────
cmd({
  pattern: 'choose',
  react: '🔀',
  desc: 'Choisir entre plusieurs options',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !q.includes('|')) return reply('Utilisation : .choose option1 | option2 | option3');
  const options = q.split('|').map(o => o.trim()).filter(Boolean);
  const chosen = options[Math.floor(Math.random() * options.length)];
  await reply(`Je choisis : ${chosen}`);
});

// ─── COIN FLIP ────────────────────────────────────────────────────────────
cmd({
  pattern: 'flip',
  alias: ['coin'],
  react: '🪙',
  desc: 'Lancer une pièce',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const result = Math.random() < 0.5 ? 'Face !' : 'Pile !';
  await reply(result);
});

// ─── DICE ─────────────────────────────────────────────────────────────────
cmd({
  pattern: 'dice',
  react: '🎲',
  desc: 'Lancer un dé',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const result = Math.floor(Math.random() * 6) + 1;
  const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][result - 1];
  await reply(`${dice} — ${result}`);
});

// ─── TRIVIA ───────────────────────────────────────────────────────────────
const triviaQuestions = [
  { q: 'Quel est le plus grand océan ?', a: 'Pacifique', opts: ['Pacifique', 'Atlantique', 'Indien', 'Arctique'] },
  { q: 'Combien de pattes a une araignée ?', a: '8', opts: ['6', '8', '10', '12'] },
  { q: 'Quelle est la capitale du Japon ?', a: 'Tokyo', opts: ['Tokyo', 'Pékin', 'Séoul', 'Bangkok'] },
  { q: 'Quel gaz est le plus abondant dans l\'atmosphère ?', a: 'Azote', opts: ['Oxygène', 'Azote', 'CO2', 'Hydrogène'] },
  { q: 'Combien de continents y a-t-il ?', a: '7', opts: ['5', '6', '7', '8'] },
  { q: 'Qui a peint la Joconde ?', a: 'Léonard de Vinci', opts: ['Léonard de Vinci', 'Picasso', 'Monet', 'Rembrandt'] },
  { q: 'Quelle est la planète la plus proche du Soleil ?', a: 'Mercure', opts: ['Mercure', 'Vénus', 'Terre', 'Mars'] },
  { q: 'Quel est le plus grand pays du monde ?', a: 'Russie', opts: ['Chine', 'Russie', 'USA', 'Canada'] },
];

cmd({
  pattern: 'trivia',
  react: '🧠',
  desc: 'Quiz général aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const t = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
  const opts = t.opts.sort(() => Math.random() - 0.5);
  const optsText = opts.map((o, i) => `${i + 1}. ${o}`).join('\n');
  const key = `${m.botNumber || 'default'}:${m.chat}`;
  triviaState.set(key, { a: t.a, opts, timestamp: Date.now() });
  await reply(`${t.q}\n\n${optsText}\n\nRéponds avec le numéro (1-4)`);
});

// ─── CONNECT 4 ────────────────────────────────────────────────────────────
cmd({
  pattern: 'connect4',
  react: '🔴',
  desc: 'Connect 4 en groupe',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const key = `${m.botNumber || 'default'}:${from}`;
  if (!connect4Games.has(key)) {
    connect4Games.set(key, { board: createBoard(), players: [m.sender], turn: 0 });
    return reply('Connect 4 lancé ! Joueur 2 tape .connect4 pour rejoindre.');
  }
  const g = connect4Games.get(key);
  if (!g.players.includes(m.sender) && g.players.length < 2) {
    g.players.push(m.sender);
    return reply(`2ème joueur rejoint !\n${g.players[0]} (🔴) vs ${g.players[1]} (🟡)\n\nUtilise .drop <1-7> pour jouer.\n${drawBoard4(g.board)}`);
  }
});

cmd({
  pattern: 'drop',
  react: '⬇️',
  desc: 'Placer un pion (Connect 4)',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { q, from, reply }) => {
  const key = `${m.botNumber || 'default'}:${from}`;
  if (!connect4Games.has(key)) return;
  const g = connect4Games.get(key);
  if (g.players.length < 2) return reply('En attente d\'un joueur...');
  if (g.players[g.turn % 2] !== m.sender) return reply('Pas ton tour.');
  const col = parseInt(q) - 1;
  if (isNaN(col) || col < 0 || col > 6) return reply('Colonne 1 à 7.');
  let placed = false;
  for (let row = 5; row >= 0; row--) {
    if (g.board[row][col] === EMPTY) { g.board[row][col] = g.turn % 2 === 0 ? RED : YELLOW; placed = true; break; }
  }
  if (!placed) return reply('Colonne pleine.');
  const color = g.turn % 2 === 0 ? RED : YELLOW;
  if (checkWin4(g.board, color)) {
    const winner = g.players[g.turn % 2];
    connect4Games.delete(key);
    return reply(`${winner.split('@')[0]} gagne !\n\n${drawBoard4(g.board)}`);
  }
  g.turn++;
  await reply(`Tour : ${g.players[g.turn % 2].split('@')[0]}\n\n${drawBoard4(g.board)}`);
});

// ─── Réponses trivia/math (appelé depuis index.cjs) ───────────────────────
function handleGamesMenuReply(sock, m) {
  const key = `${m.botNumber || 'default'}:${m.chat}`;
  const text = (m.body || '').trim().toLowerCase();

  // Math quiz
  const math = mathQuizState.get(key);
  if (math && Date.now() - math.timestamp < 60000) {
    const userAnswer = parseFloat(text);
    if (!isNaN(userAnswer)) {
      mathQuizState.delete(key);
      if (userAnswer === math.answer) {
        m.reply('Bonne réponse !').catch(() => {});
      } else {
        m.reply(`Non, c'est ${math.answer}`).catch(() => {});
      }
      return true;
    }
  }

  // Trivia
  const trivia = triviaState.get(key);
  if (trivia && Date.now() - trivia.timestamp < 60000) {
    const num = parseInt(text);
    if (num >= 1 && num <= trivia.opts.length) {
      triviaState.delete(key);
      const chosen = trivia.opts[num - 1];
      if (chosen === trivia.a) {
        m.reply('Exactement !').catch(() => {});
      } else {
        m.reply(`C'était ${trivia.a}`).catch(() => {});
      }
      return true;
    }
    // Réponse naturelle
    const answerLower = text.toLowerCase();
    const correctLower = trivia.a.toLowerCase();
    if (answerLower === correctLower || answerLower.includes(correctLower)) {
      triviaState.delete(key);
      m.reply('Exactement !').catch(() => {});
      return true;
    }
  }

  return false;
}

module.exports = { handleGamesMenuReply };
