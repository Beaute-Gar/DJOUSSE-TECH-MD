const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fetch = require('node-fetch');
const quizSessions = new Map();
function decodeHTML(str) { return str.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }

cmd({
  pattern: 'question',
  react: '❓',
  desc: 'Quiz question aléatoire',
  category: 'fun',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (quizSessions.has(from)) return reply('⏳ Quiz déjà en cours !');
  try {
    const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await res.json();
    if (!data.results?.length) return reply('❌ Quiz indisponible.');
    const q = data.results[0];
    const allAnswers = [...q.incorrect_answers, q.correct_answer];
    const shuffled = allAnswers.sort(() => Math.random() - 0.5);
    const correctIndex = shuffled.indexOf(q.correct_answer);
    const difficulty = q.difficulty.toLowerCase();
    const points = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15;
    const options = shuffled.map((a, i) => (i + 1) + '. ' + decodeHTML(a)).join('\n');
    const text = box('❓ *QUESTION*', [
      { label: 'Catégorie', value: q.category }, { label: 'Difficulté', value: difficulty },
      { label: 'Points', value: String(points) }, { blank: true },
      { raw: '*Question:* ' + decodeHTML(q.question) }, { blank: true }, { raw: options },
      { blank: true }, { raw: '_Réponds avec le numéro (1-4)_\n_Tu as 30 secondes_' },
    ]);
    await conn.sendMessage(from, { text }, { quoted: m });
    quizSessions.set(from, { answer: correctIndex + 1, points, timestamp: Date.now() });
    setTimeout(() => { if (quizSessions.has(from)) { reply('⏰ Temps écoulé ! Réponse: ' + decodeHTML(q.correct_answer)); quizSessions.delete(from); } }, 30000);
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});
