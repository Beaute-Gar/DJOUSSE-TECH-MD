import { createLogger } from '../../core/logger.js';
import { EVENTS, bus } from '../event-bus.js';
import { communityStore } from './community-store.js';
import { executor, ACTION_TYPES } from '../action-executor.js';
import { observeInteraction, updateProfile } from '../digital-twin.js';
import { addNode, NODE_TYPES } from '../knowledge-graph.js';
import { clock } from '../cognitive-clock.js';

const log = createLogger('SCG:GAMES');

const QUIZ_DATA = {
  gaming: {
    questions: [
      { q: 'Quel jeu est connu pour ses cubes ?', options: ['Minecraft', 'Roblox', 'Fortnite', 'Tetris'], answer: 0 },
      { q: 'Dans quel jeu trouve-t-on un battle royale avec construction ?', options: ['PUBG', 'Fortnite', 'Apex', 'Warzone'], answer: 1 },
      { q: 'Quel est le jeu le plus joué au monde ?', options: ['Minecraft', 'Roblox', 'Fortnite', 'League of Legends'], answer: 0 },
    ],
  },
  anime: {
    questions: [
      { q: 'Quel est le vrai nom de Luffy ?', options: ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Sanji'], answer: 0 },
      { q: 'Quel anime parle de chasseurs de démons ?', options: ['Naruto', 'Demon Slayer', 'One Piece', 'Bleach'], answer: 1 },
      { q: 'Dans Naruto, quel est le rêve de Naruto ?', options: ['Devenir Hokage', 'Devenir fort', 'Protéger ses amis', 'Vaincre Sasuke'], answer: 0 },
    ],
  },
  football: {
    questions: [
      { q: 'Qui a gagné la Coupe du Monde 2022 ?', options: ['France', 'Argentine', 'Brésil', 'Allemagne'], answer: 1 },
      { q: 'Quel joueur a le plus de Ballons d\'Or ?', options: ['Messi', 'Ronaldo', 'Neymar', 'Mbappé'], answer: 0 },
      { q: 'Quel club a gagné la Ligue des Champions 2023 ?', options: ['Real Madrid', 'Man City', 'Bayern', 'PSG'], answer: 1 },
    ],
  },
  general: {
    questions: [
      { q: 'Quel est le plus grand océan du monde ?', options: ['Atlantique', 'Pacifique', 'Indien', 'Arctique'], answer: 1 },
      { q: 'Combien de continents y a-t-il ?', options: ['5', '6', '7', '8'], answer: 2 },
      { q: 'Qui a peint la Joconde ?', options: ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Van Gogh'], answer: 2 },
    ],
  },
};

const DEVINETTES = [
  { q: 'Je suis grand quand je suis jeune et petit quand je suis vieux. Que suis-je ?', a: 'Une bougie' },
  { q: 'Plus on me retire, plus je deviens grand. Que suis-je ?', a: 'Un trou' },
  { q: 'Je parle toutes les langues sans avoir de bouche. Que suis-je ?', a: 'Un écho' },
  { q: 'Je t\'appartiens mais tout le monde t\'emprunte. Que suis-je ?', a: 'Ton nom' },
  { q: 'Je vole sans ailes, je pleure sans yeux. Que suis-je ?', a: 'Un nuage' },
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatQuizQuestion(q, current, total) {
  const emojis = ['1⃣', '2⃣', '3⃣', '4⃣'];
  const lines = q.options.map((opt, i) => `${emojis[i]} ${opt}`);
  return `╔═══════════════════════════════╗
║        *Quiz* (${current}/${total})       ║
╚═══════════════════════════════╝

${q.q}

${lines.join('\n')}

_Répondez avec le numéro de votre choix_`;
}

function formatDevinette(d, current, total) {
  return `╔═══════════════════════════════╗
║      *Devinette* (${current}/${total})    ║
╚═══════════════════════════════╝

${d.q}

_Quelle est la réponse ?_`;
}

function formatClassement(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1].points - a[1].points);
  const lines = sorted.slice(0, 10).map(([jid, s], i) => {
    const name = jid.split('@')[0];
    const badges = s.badges.length > 0 ? ` 🏅${s.badges.slice(0, 3).join('/')}` : '';
    return `${i + 1}. @${name} — ${s.points} pts (Niv. ${s.level})${badges}`;
  });

  return `╔═══════════════════════════════╗
║      *Classement Communauté*    ║
╚═══════════════════════════════╝

${lines.join('\n')}

━━━━━━━━━━━━━━━━━━━
${sorted.length} participant${sorted.length > 1 ? 's' : ''}
_Continuez à participer pour monter dans le classement !_`;
}

export async function handleStartQuiz(ctx, args, sock) {
  const profile = communityStore.getGroupProfile(ctx.jid);
  const type = profile.type || 'general';
  const quizData = QUIZ_DATA[type] || QUIZ_DATA.general;
  const questions = shuffle(quizData.questions).slice(0, 5);

  const game = {
    type: 'quiz',
    questions,
    currentIndex: 0,
    answers: {},
    startedAt: Date.now(),
    status: 'active',
  };

  communityStore.setCurrentGame(ctx.jid, game);

  bus.emit('scg:game:started', { groupJid: ctx.jid, gameType: 'quiz', questions: questions.length });

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: `🎯 *Quiz lancé !*\n\n${questions.length} questions. Répondez avec le numéro de votre choix. Le classement sera mis à jour à la fin !` },
    source: 'scg:games:quiz:start',
  });

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: formatQuizQuestion(questions[0], 1, questions.length) },
    source: 'scg:games:quiz:q1',
  });
}

export async function handleStartDevinette(ctx, args, sock) {
  const devinettes = shuffle(DEVINETTES).slice(0, 3);
  let current = 0;

  const game = {
    type: 'devinette',
    devinettes,
    currentIndex: 0,
    revealed: [],
    status: 'active',
  };

  communityStore.setCurrentGame(ctx.jid, game);

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: `🧩 *Devinettes !*\n\n${devinettes.length} devinettes. À vous de trouver les réponses !` },
    source: 'scg:games:devinette:start',
  });

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: formatDevinette(devinettes[0], 1, devinettes.length) },
    source: 'scg:games:devinette:q1',
  });
}

export async function handleClassement(ctx, args, sock) {
  const scores = communityStore.getGameScores(ctx.jid);
  if (Object.keys(scores).length === 0) {
    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: { jid: ctx.jid, text: 'Aucun score pour le moment. Participez aux quiz et jeux pour gagner des points !' },
      source: 'scg:games:classement:empty',
    });
    return;
  }
  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: formatClassement(scores) },
    source: 'scg:games:classement',
  });
}

function processQuizAnswer(jid, senderJid, text, game) {
  const q = game.questions[game.currentIndex];
  const num = parseInt(text.trim());
  if (isNaN(num) || num < 1 || num > q.options.length) return false;

  const correct = num - 1 === q.answer;
  if (!game.answers[senderJid]) game.answers[senderJid] = { correct: 0, total: 0 };
  game.answers[senderJid].total++;
  if (correct) game.answers[senderJid].correct++;

  return { correct, answer: q.options[q.answer], num };
}

function processDevinetteAnswer(jid, senderJid, text, game) {
  const d = game.devinettes[game.currentIndex];
  const correct = text.toLowerCase().trim() === d.a.toLowerCase();

  if (correct && !game.revealed.includes(senderJid)) {
    game.revealed.push(senderJid);
  }

  return { correct, answer: d.a };
}

async function advanceQuiz(jid, game) {
  game.currentIndex++;
  if (game.currentIndex >= game.questions.length) {
    communityStore.clearCurrentGame(jid);
    bus.emit('scg:game:ended', { groupJid: jid, gameType: 'quiz' });

    for (const [senderJid, ans] of Object.entries(game.answers)) {
      const ratio = ans.total > 0 ? ans.correct / ans.total : 0;
      const points = Math.round(ratio * 100);
      let badge = null;
      if (ratio === 1) badge = 'parfait';
      else if (ratio >= 0.8) badge = 'brillant';
      else if (ratio >= 0.6) badge = 'bien';

      communityStore.updateGameScore(jid, senderJid, points, badge);

      updateProfile(senderJid, {
        lastQuizScore: points,
        lastQuizDate: Date.now(),
      });

      observeInteraction(senderJid, 'quiz_completed', `${points}pts`);

      if (badge) {
        addNode(`badge:${senderJid}:${badge}`, NODE_TYPES.CONCEPT, {
          type: 'badge', badge, jid: senderJid, group: jid, timestamp: Date.now(),
        }).catch(() => {});
        bus.emit('scg:reward:awarded', { groupJid: jid, memberJid: senderJid, badge, points });
      }
    }

    const summary = Object.entries(game.answers)
      .sort((a, b) => (b[1].correct / Math.max(1, b[1].total)) - (a[1].correct / Math.max(1, a[1].total)))
      .slice(0, 5)
      .map(([jid, a]) => `@${jid.split('@')[0]} — ${a.correct}/${a.total} (${Math.round((a.correct / a.total) * 100)}%)`)
      .join('\n');

    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: {
        jid,
        text: `🏆 *Quiz terminé !*\n\nRésultats :\n${summary}\n\n📊 Tapez ".OS classement" pour voir le classement général.`,
      },
      source: 'scg:games:quiz:end',
    });

    return;
  }

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: {
      jid,
      text: formatQuizQuestion(game.questions[game.currentIndex], game.currentIndex + 1, game.questions.length),
    },
    source: 'scg:games:quiz:next',
  });
}

async function advanceDevinette(jid, game) {
  game.currentIndex++;
  if (game.currentIndex >= game.devinettes.length) {
    communityStore.clearCurrentGame(jid);

    for (const j of game.revealed) {
      communityStore.updateGameScore(jid, j, 50, 'devinette');
    }

    const msg = game.revealed.length > 0
      ? `🎉 Devinettes terminées ! ${game.revealed.length} personne${game.revealed.length > 1 ? 's' : ''} a/aont trouvé !`
      : '😅 Personne n\'a trouvé toutes les devinettes.';

    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: { jid, text: msg },
      source: 'scg:games:devinette:end',
    });

    return;
  }

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: {
      jid,
      text: formatDevinette(game.devinettes[game.currentIndex], game.currentIndex + 1, game.devinettes.length),
    },
    source: 'scg:games:devinette:next',
  });
}

export function registerCommunityGames(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup } = data;
    if (!isGroup || !text) return;

    const game = communityStore.getCurrentGame(jid);
    if (!game || game.status !== 'active') return;

    if (game.type === 'quiz') {
      const result = processQuizAnswer(jid, senderJid, text, game);
      if (result === false) return;

      if (result.correct) {
        executor.execute({
          type: ACTION_TYPES.REACT,
          payload: { jid, key: data.episode?.msgKey, emoji: '✅' },
          source: 'scg:games:quiz:correct',
        }).catch(() => {});
      } else {
        executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: `❌ @${senderJid.split('@')[0]} — La réponse était : ${result.answer}` },
          source: 'scg:games:quiz:wrong',
        }).catch(() => {});
      }

      const q = game.questions[game.currentIndex];
      const answeredCount = Object.keys(game.answers).length;
      const totalMembers = communityStore.getStats(jid)?.activeMembers || 5;
      if (answeredCount >= totalMembers * 0.7 || answeredCount >= Math.max(10, totalMembers)) {
        await advanceQuiz(jid, game);
      }
    }

    if (game.type === 'devinette') {
      const result = processDevinetteAnswer(jid, senderJid, text, game);

      if (result.correct) {
        executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: `✅ @${senderJid.split('@')[0]} a trouvé !` },
          source: 'scg:games:devinette:found',
        }).catch(() => {});

        const d = game.devinettes[game.currentIndex];
        const foundPct = game.revealed.length / Math.max(1, communityStore.getStats(jid)?.activeMembers || 5);
        if (game.revealed.length >= 3 || foundPct > 0.5) {
          await advanceDevinette(jid, game);
        }
      }
    }
  }, { priority: 60, description: 'scg:games:answer' });

  pipeline.on('heartbeat:five_minutes', async () => {
    for (const jid of communityStore.getAllGroups()) {
      const game = communityStore.getCurrentGame(jid);
      if (!game) continue;

      if (game.type === 'quiz') {
        const q = game.questions[game.currentIndex];
        const elapsed = Date.now() - game.startedAt;
        if (elapsed > 60000 * game.questions.length * 2) {
          await advanceQuiz(jid, game);
          log.info(`Forcing quiz advance in ${jid} (timeout)`);
        }
      }

      if (game.type === 'devinette') {
        const elapsed = Date.now() - game.startedAt;
        if (elapsed > 300000 * game.devinettes.length) {
          await advanceDevinette(jid, game);
        }
      }
    }
  }, { priority: 20, description: 'scg:games:timeout' });

  log.info('[SCG:GAMES] Registered');
}
