/* ═══════════════════════════════════════════════════════════════════════════
   GAMES v3 — DJOUSSE TECH EVOLUTION
   10 jeux interactifs · IA générative · Persistance · Mentions WhatsApp
   Fonctionne en GROUPE et en DISCUSSION PRIVÉE (DM).
   Tout contenu (questions, défis, dilemmes, mots) généré dynamiquement.
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { cmd } = require('../command.cjs');
const { chatSystem } = require('../lib/ai.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════════ */
const DIFFICULTY = 'EXTREME';
const SAVE_FILE = path.join(__dirname, '..', 'database', 'games_data.json');
const USED_FILE = path.join(__dirname, '..', 'database', 'games_used.json');

const REGISTRATION_MS = parseInt(process.env.AVT_REGISTRATION_MS || '60000', 10);
const ROUND_MS = parseInt(process.env.AVT_ROUND_MS || String(5 * 60 * 1000), 10);
const QUIZ_TIMER = parseInt(process.env.QUIZ_TIMER || '30000', 10);
const WYR_TIMER = parseInt(process.env.WYR_TIMER || '60000', 10);
const GUESS_TIMER = parseInt(process.env.GUESS_TIMER || '120000', 10);
const HANGMAN_TIMER = parseInt(process.env.HANGMAN_TIMER || '60000', 10);
const STORY_TIMER = parseInt(process.env.STORY_TIMER || '60000', 10);
const TF_TIMER = parseInt(process.env.TF_TIMER || '60000', 10);
const RPS_TIMER = parseInt(process.env.RPS_TIMER || '30000', 10);
const DRAW_TIMER = parseInt(process.env.DRAW_TIMER || '120000', 10);
const MAX_AI_RETRIES = 3;

/* ═══════════════════════════════════════════════════════════════════════════
   ÉTAT EN MÉMOIRE + PERSISTANCE
   ═══════════════════════════════════════════════════════════════════════════ */
const activeGames = new Map();
let usedQuestionsCache = {};

function ensureDir() {
  try { fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true }); } catch {}
}

function saveGames() {
  ensureDir();
  const data = {};
  for (const [chatId, game] of activeGames) {
    const s = game.state;
    data[chatId] = {
      type: game.type,
      chatId,
      startedAt: game.startedAt || Date.now(),
      state: serializeState(s, game.type),
      lastUpdate: Date.now(),
    };
  }
  try { fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2)); } catch {}
}

function loadGames() {
  ensureDir();
  if (!fs.existsSync(SAVE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { return {}; }
}

function saveUsed() {
  ensureDir();
  try { fs.writeFileSync(USED_FILE, JSON.stringify(usedQuestionsCache, null, 2)); } catch {}
}

function loadUsed() {
  ensureDir();
  if (!fs.existsSync(USED_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USED_FILE, 'utf8')); } catch { return {}; }
}

function getUsed(chatId) {
  if (!usedQuestionsCache[chatId]) usedQuestionsCache[chatId] = [];
  return usedQuestionsCache[chatId];
}

function addUsed(chatId, question) {
  const list = getUsed(chatId);
  if (!list.includes(question)) {
    list.push(question);
    if (list.length > 50) list.shift();
    saveUsed();
  }
}

function serializeState(state, type) {
  const s = { ...state };
  s.registered = [...(state.registered || [])];
  s.scores = [...(state.scores || [])];
  s.completed = [...(state.completed || [])];
  s.pendingChallenge = [...(state.pendingChallenge || [])];
  s.choices = [...(state.choices || [])];
  s.guesses = [...(state.guesses || [])];
  s.guessedLetters = [...(state.guessedLetters || [])];
  s.contributors = [...(state.contributors || [])];
  s.votes = [...(state.votes || [])];
  return s;
}

function deserializeState(raw, type) {
  const s = { ...raw };
  s.registered = new Set(raw.registered || []);
  s.scores = new Map(raw.scores || []);
  s.completed = new Map(raw.completed || []);
  s.pendingChallenge = new Map(raw.pendingChallenge || []);
  s.choices = new Map(raw.choices || []);
  s.guesses = new Set(raw.guesses || []);
  s.guessedLetters = new Set(raw.guessedLetters || []);
  s.contributors = new Set(raw.contributors || []);
  s.votes = new Map(raw.votes || []);
  return s;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OUTILS IA — 3 NIVEAUX DE SECOURS
   ═══════════════════════════════════════════════════════════════════════════ */
const AI_PROMPTS = {
  avt_action: (used) => `Tu es le maître du jeu "Action ou Vérité" niveau ${DIFFICULTY} pour adultes (+18).
Génère UNE SEULE action audacieuse, provocante et originale, en français.
Rien d'illégal, rien de dangereux physiquement, respect du consentement.
Réponds uniquement avec le défi, une phrase, sans préambule.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,

  avt_verite: (used) => `Tu es le maître du jeu "Action ou Vérité" niveau ${DIFFICULTY} pour adultes (+18).
Génère UNE SEULE question audacieuse, provocante et originale, en français.
Réponds uniquement avec la question, sans préambule.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,

  quiz: (used) => `Génère une question de culture générale niveau DIFFICILE pour adultes.
Sujets variés : sciences, histoire, arts, géographie, pop culture.
Réponds UNIQUEMENT au format exact : QUESTION? | A) ... | B) ... | C) ... | D) ... | Réponse: X
Où X est la lettre (A, B, C ou D) de la bonne réponse.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,

  wyr: (used) => `Génère un dilemme "Would you rather" niveau ${DIFFICULTY} pour adultes (+18).
Deux options provocantes, audacieuses, mémorables.
Format exact : Option 1 : ... | Option 2 : ...
Réponds UNIQUEMENT avec ce format, rien d'autre.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,

  hangman: (used) => `Génère un mot en français (nom commun) de 6 à 9 lettres, sans accent, sans trait d'union, sans espace.
Niveau de difficulté élevé pour un jeu de pendu.
Réponds UNIQUEMENT avec le mot en minuscules, rien d'autre.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,

  tf: (used) => `Génère une affirmation étonnante, surprenante ou controversée sur un sujet de culture générale ou scientifique.
Réponds au format exact :
AFFIRMATION.
VRAI
Ou
AFFIRMATION.
FAUX
Rien d'autre.
${used.length ? 'DIFFÉRENT de : ' + used.slice(-10).join(' ; ') : ''}`,
};

async function aiGenerate(chatId, promptType, opts = {}) {
  const used = getUsed(chatId);
  const prompt = AI_PROMPTS[promptType](used);
  const text = opts.text || '';
  const fallbacks = opts.fallbacks || [];

  // Niveau 1 : IA principale
  for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
    try {
      const out = await chatSystem(prompt, text || 'Génère maintenant.');
      const result = parseAIResult(out, promptType);
      if (result) {
        addUsed(chatId, result.raw || result.text || JSON.stringify(result));
        return result;
      }
    } catch {}
  }

  // Niveau 2 : IA secondaire (groq rapide)
  try {
    const { groq, MODELS } = require('../lib/ai.cjs');
    const messages = [{ role: 'user', content: prompt.slice(0, 2000) }];
    const out = await groq(messages, { model: MODELS.chatFast, temperature: 0.8, maxTokens: 500 });
    const result = parseAIResult(out, promptType);
    if (result) {
      addUsed(chatId, result.raw || result.text || JSON.stringify(result));
      return result;
    }
  } catch {}

  // Niveau 3 : fallback aléatoire
  return generateRandomFallback(promptType, used);
}

function parseAIResult(out, type) {
  const clean = String(out || '').trim().replace(/^["'«»]|["'«»]$/g, '');
  if (!clean || clean.length < 3) return null;

  if (type === 'quiz') {
    const parts = clean.split('|').map(s => s.trim());
    if (parts.length >= 6) {
      const qMatch = parts[0];
      const opts = [parts[1], parts[2], parts[3], parts[4]].map(s => s.replace(/^[A-Da-d]\)\s*/, ''));
      const ans = (parts[5] || '').replace(/réponse\s*:?\s*/i, '').trim().toUpperCase();
      const correct = 'ABCD'.indexOf(ans.charAt(0));
      if (correct >= 0 && opts.every(o => o.length > 0)) {
        return { question: qMatch, options: opts, correct, raw: clean };
      }
    }
  }

  if (type === 'wyr') {
    const parts = clean.split('|').map(s => s.trim());
    if (parts.length >= 2) {
      const opt1 = parts[0].replace(/^Option 1\s*:?\s*/i, '');
      const opt2 = parts[1].replace(/^Option 2\s*:?\s*/i, '');
      if (opt1 && opt2) return { opt1, opt2, raw: clean };
    }
  }

  if (type === 'tf') {
    const lines = clean.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const statement = lines[0].replace(/\.\s*(VRAI|FAUX)\s*$/i, '');
      const answer = lines[lines.length - 1].toLowerCase().includes('vrai');
      return { statement, answer, raw: clean };
    }
    if (lines.length === 1) {
      const m = lines[0].match(/(.+)\.\s*(VRAI|FAUX)\s*$/i);
      if (m) return { statement: m[1], answer: m[2].toUpperCase() === 'VRAI', raw: clean };
    }
  }

  if (type === 'hangman') {
    const word = clean.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length >= 5 && word.length <= 10) return { word, raw: word };
  }

  if (type === 'avt_action' || type === 'avt_verite') {
    return { text: truncate(clean, 300), raw: clean };
  }

  return null;
}

function generateRandomFallback(type, used) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const notUsed = (arr) => { const avail = arr.filter(x => !used.includes(x)); return avail.length ? pick(arr) : pick(arr); };

  if (type === 'quiz') {
    const qs = [
      { question: 'Quelle est la capitale de l\'Australie ?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correct: 2 },
      { question: 'Qui a écrit "Les Misérables" ?', options: ['Stendhal', 'Victor Hugo', 'Balzac', 'Flaubert'], correct: 1 },
      { question: 'Quel est le plus long fleuve d\'Europe ?', options: ['Rhin', 'Danube', 'Volga', 'Dniepr'], correct: 2 },
      { question: 'Combien de molécules d\'eau dans H2O ?', options: ['1', '2', '3', '4'], correct: 2 },
      { question: 'Quel organe produit l\'insuline ?', options: ['Foie', 'Rein', 'Pancréas', 'Rate'], correct: 2 },
      { question: 'En quelle année est tombé le mur de Berlin ?', options: ['1987', '1989', '1991', '1993'], correct: 1 },
      { question: 'Quel est le gaz le plus abondant dans l\'atmosphère ?', options: ['Oxygène', 'Azote', 'Argon', 'CO2'], correct: 1 },
      { question: 'Qui a peint la "Nuit étoilée" ?', options: ['Monet', 'Van Gogh', 'Picasso', 'Renoir'], correct: 1 },
      { question: 'Quel est le plus petit continent ?', options: ['Europe', 'Océanie', 'Antarctique', 'Amérique du Sud'], correct: 1 },
      { question: 'Combien de chromosomes humains ?', options: ['23', '44', '46', '48'], correct: 2 },
    ];
    return pick(qs);
  }

  if (type === 'wyr') {
    const dy = [
      { opt1: 'Ne plus jamais pouvoir rire', opt2: 'Ne plus jamais pouvoir pleurer' },
      { opt1: 'Parler tous les langages humains', opt2: 'Parler à tous les animaux' },
      { opt1: 'Voyager dans le passé', opt2: 'Voyager dans le futur' },
      { opt1: 'Avoir la télépathie', opt2: 'Avoir la téléportation' },
      { opt1: 'Être invisible', opt2: 'Être intouchable' },
      { opt1: 'Vivre sans internet', opt2: 'Vivre sans musique' },
    ];
    return pick(dy);
  }

  if (type === 'tf') {
    const tf = [
      { statement: 'Les flamingos naissent blancs', answer: true },
      { statement: 'Le son voyage plus vite que la lumière', answer: false },
      { statement: 'Les dauphins sont des mammifères', answer: true },
      { statement: 'La Lune est une étoile', answer: false },
      { statement: 'Le sucre rend les enfants hyperactifs', answer: false },
      { statement: 'Les tortues peuvent vivre sans leur tête', answer: true },
    ];
    return pick(tf);
  }

  if (type === 'hangman') {
    const words = ['ordinateur', 'programme', 'universite', 'bibliotheque', 'crocodile', 'oiseau', 'chocolat', 'tentative', 'professeur', 'ecran'];
    const w = notUsed(words).toLowerCase();
    return { word: w, raw: w };
  }

  if (type === 'avt_action') {
    const d = ['Fais 10 pompes en criant le nom du bot', 'Imite un animal de ton choix pendant 15 secondes', 'Danse comme si tu étais sur une scène devant 1000 personnes', 'Fais un discours de 30 secondes pour devenir roi/roi du monde'];
    return { text: notUsed(d), raw: notUsed(d) };
  }

  if (type === 'avt_verite') {
    const d = ['Quel est ton plus grand secret que personne ne sait ?', 'Quelle est la chose la plus embarrassante qui te soit arrivée ?', 'Si tu pouvais changer une seule chose dans ta vie, ce serait quoi ?', 'Quel est ton fantasme le plus fou ?'];
    return { text: notUsed(d), raw: notUsed(d) };
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITAIRE DM / GROUP
   ══════════════════════════════════════════════════════════════════════════ */
function isDM(jid) {
  // DM: jid is a user JID (ends with @s.whatsapp.net typically, but more simply check no @g.us)
  // Group: jid ends with @g.us
  return !String(jid || '').endsWith('@g.us');
}

async function getDisplayName(conn, jid) {
  try {
    const name = await conn.getName(jid);
    return name || jid.split('@')[0];
  } catch {
    return jid.split('@')[0];
  }
}

function mention(jid) {
  return '@' + String(jid).split('@')[0];
}

function mentions(list) {
  return (list || []).filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 1 : ACTION OU VÉRITÉ (AVT)
   ═══════════════════════════════════════════════════════════════════════════ */
function createAvtState(chat, startedBy) {
  return {
    type: 'avt', phase: 'registration',
    registered: new Set(), scores: new Map(), completed: new Map(),
    pendingChallenge: new Map(), roundNumber: 0,
    startedBy, registrationTimer: null, roundTimer: null, chat,
  };
}

async function avtGenererDefi(chatId, type) {
  const result = await aiGenerate(chatId, type === 'action' ? 'avt_action' : 'avt_verite');
  return result ? result.text : null;
}

async function avtSendRound(sock, state) {
  state.roundNumber++;
  const regList = [...state.registered];
  const text = box(`🎲 *ACTION OU VÉRITÉ — Manche ${state.roundNumber}*`, [
    { raw: regList.length ? regList.map(mention).join(' ') : '_Tout le monde peut répondre !_' },
    { blank: true },
    { raw: '👉 Réponds *action* ou *vérité* pour recevoir ton défi.' },
    { raw: `⏱️ Manche de ${ROUND_MS / 60000} min — Niveau *${DIFFICULTY}* 🔥` },
    { raw: '⚠️ Système déclaratif — réponds pour valider, en toute bonne foi.' },
  ]);
  await sock.sendMessage(state.chat, { text, mentions: regList });
  saveGames();
  clearTimeout(state.roundTimer);
  state.roundTimer = setTimeout(() => avtCloseRound(sock, state), ROUND_MS);
}

async function avtCloseRound(sock, state) {
  state.phase = 'ended';
  const entries = [...state.scores.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [];
  const mList = [];
  if (!entries.length) lines.push({ raw: "Personne n'a validé de défi ce tour-ci ! 😅" });
  else {
    for (let i = 0; i < Math.min(entries.length, 5); i++) {
      const [jid, score] = entries[i];
      const medal = ['🥇', '🥈', '🥉'][i] || '▫️';
      const name = await getDisplayName(sock, jid);
      lines.push({ raw: `${medal} @${name} — ${score} défi(s) validé(s)` });
      mList.push(jid);
    }
  }
  lines.push({ blank: true, raw: '🔁 Tape *.avt* pour relancer.' });
  await sock.sendMessage(state.chat, {
    text: box('🏆 *FIN DE MANCHE — CLASSEMENT*', lines),
    mentions: mList,
  }).catch(() => {});
  activeGames.delete(state.chat);
  saveGames();
}

async function avtHandleRaw(sock, m, state) {
  if (state.phase !== 'round' || !m.body) return false;
  const text = m.body.trim().toLowerCase();
  const sender = m.sender;
  const senderName = await getDisplayName(sock, sender);

  if ((text === 'action' || text === 'vérité' || text === 'verite') && !state.pendingChallenge.has(sender)) {
    const type = text === 'action' ? 'action' : 'verite';
    const notRegistered = !state.registered.has(sender);
    const defi = await avtGenererDefi(state.chat, type);
    if (!defi) {
      await m.reply(`❌ @${senderName}, impossible de générer un défi pour le moment.`).catch(() => {});
      return true;
    }
    state.pendingChallenge.set(sender, { type, text: defi, sentAt: Date.now() });
    await sock.sendMessage(state.chat, {
      text: box(type === 'action' ? '🔥 *ACTION*' : '💭 *VÉRITÉ*', [
        { raw: `@${senderName}` }, { blank: true }, { raw: defi }, { blank: true },
        { raw: notRegistered ? '⚠️ Tape *.jouer* pour que ça compte.' : '_Réponds pour valider ton défi._' },
      ]),
      mentions: [sender],
    });
    saveGames();
    return true;
  }

  if (state.pendingChallenge.has(sender)) {
    state.pendingChallenge.delete(sender);
    if (state.registered.has(sender)) {
      state.scores.set(sender, (state.scores.get(sender) || 0) + 1);
      state.completed.set(sender, (state.completed.get(sender) || 0) + 1);
      await m.reply(`✅ Défi validé @${senderName} ! Score : ${state.scores.get(sender)} pt(s).`).catch(() => {});
    } else {
      await m.reply(`✅ Défi noté @${senderName}, mais tu n'es pas inscrit — tape *.jouer*.`).catch(() => {});
    }
    saveGames();
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 2 : QUIZ (100% IA)
   ═══════════════════════════════════════════════════════════════════════════ */
function createQuizState(chat) {
  return {
    type: 'quiz', currentQuestion: 0, totalQuestions: 10,
    scores: new Map(), answered: new Set(), timer: null, chat, startedBy: null,
    questions: [],
  };
}

async function quizSendQuestion(sock, state) {
  const qi = state.currentQuestion;
  if (qi >= state.totalQuestions) { await quizFinish(sock, state); return; }

  let q;
  if (state.questions[qi]) {
    q = state.questions[qi];
  } else {
    const result = await aiGenerate(state.chat, 'quiz');
    q = result || { question: 'Question indisponible', options: ['A', 'B', 'C', 'D'], correct: 0 };
    state.questions[qi] = q;
  }

  const optsText = q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
  await sock.sendMessage(state.chat, {
    text: box(`📚 *QUESTION ${qi + 1} / ${state.totalQuestions}*`, [
      { raw: q.question }, { blank: true }, { raw: optsText }, { blank: true },
      { raw: 'Réponds avec A, B, C ou D.' },
    ]),
  });
  state.answered = new Set();
  saveGames();
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    await sock.sendMessage(state.chat, { text: '⏰ Temps écoulé ! Question suivante.' });
    state.currentQuestion++;
    await quizSendQuestion(sock, state);
  }, QUIZ_TIMER);
}

async function quizFinish(sock, state) {
  clearTimeout(state.timer);
  const sorted = [...state.scores.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [];
  const mlist = [];
  if (!sorted.length) lines.push({ raw: 'Personne n\'a marqué de point.' });
  else {
    for (let i = 0; i < Math.min(sorted.length, 5); i++) {
      const [jid, pts] = sorted[i];
      const name = await getDisplayName(sock, jid);
      lines.push({ raw: `${['🥇', '🥈', '🥉'][i] || '▫️'} @${name} — ${pts} pt(s)` });
      mlist.push(jid);
    }
  }
  await sock.sendMessage(state.chat, {
    text: box('🏁 *FIN DU QUIZ — CLASSEMENT*', lines),
    mentions: mlist,
  });
  activeGames.delete(state.chat);
  saveGames();
}

async function quizHandleRaw(sock, m, state) {
  if (!m.body) return false;
  const text = m.body.trim().toUpperCase();
  if (!/^[A-D]$/.test(text)) return false;
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (state.answered.has(sender)) {
    await m.reply(`@${name}, tu as déjà répondu !`).catch(() => {});
    return true;
  }
  const q = state.questions[state.currentQuestion];
  if (!q) return false;
  const choice = text.charCodeAt(0) - 65;
  if (choice === q.correct) {
    state.scores.set(sender, (state.scores.get(sender) || 0) + 1);
    await m.reply(`✅ Bonne réponse @${name} ! (+1 pt)`).catch(() => {});
  } else {
    await m.reply(`❌ Mauvaise réponse @${name}… La bonne était ${String.fromCharCode(65 + q.correct)}.`).catch(() => {});
  }
  state.answered.add(sender);
  saveGames();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 3 : WOULD YOU RATHER (100% IA)
   ═══════════════════════════════════════════════════════════════════════════ */
function createWyrState(chat) {
  return { type: 'wyr', currentDilemma: null, votes: new Map(), timer: null, chat, startedBy: null };
}

async function wyrSend(sock, state) {
  const result = await aiGenerate(state.chat, 'wyr');
  const dilemma = result || { opt1: 'Option 1', opt2: 'Option 2' };
  state.currentDilemma = dilemma;
  state.votes = new Map();
  await sock.sendMessage(state.chat, {
    text: box('🤔 *WOULD YOU RATHER*', [
      { raw: '1. ' + dilemma.opt1 }, { raw: '2. ' + dilemma.opt2 }, { blank: true },
      { raw: 'Réponds avec *1* ou *2*.' },
    ]),
  });
  saveGames();
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    const v1 = [...state.votes.values()].filter(v => v === 1).length;
    const v2 = [...state.votes.values()].filter(v => v === 2).length;
    const winner = v1 > v2 ? 'Option 1' : (v2 > v1 ? 'Option 2' : 'Égalité');
    await sock.sendMessage(state.chat, {
      text: `⏰ Vote terminé !\n📊 Option 1 : ${v1} voix\n📊 Option 2 : ${v2} voix\n🏆 Résultat : *${winner}*\n\nTape *.wyr* pour un nouveau dilemme.`,
    });
    activeGames.delete(state.chat);
    saveGames();
  }, WYR_TIMER);
}

async function wyrHandleRaw(sock, m, state) {
  if (!m.body) return false;
  const text = m.body.trim();
  if (!/^[12]$/.test(text)) return false;
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (state.votes.has(sender)) {
    await m.reply(`@${name}, tu as déjà voté !`).catch(() => {});
    return true;
  }
  state.votes.set(sender, parseInt(text, 10));
  await m.reply(`✅ @${name}, vote enregistré (option ${text}).`).catch(() => {});
  saveGames();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 4 : PIERRE-PAPIER-CISEAUX
   ═══════════════════════════════════════════════════════════════════════════ */
function createRpsState(chat, challenger) {
  return {
    type: 'rps', challenger, opponent: null, choices: new Map(),
    timer: null, chat, startedBy: challenger, phase: 'waiting_opponent',
  };
}

function rpsWinner(c1, c2) {
  if (c1 === c2) return 0;
  if ((c1 === 'pierre' && c2 === 'ciseaux') || (c1 === 'ciseaux' && c2 === 'papier') || (c1 === 'papier' && c2 === 'pierre')) return 1;
  return 2;
}

async function rpsHandleRaw(sock, m, state) {
  if (!m.body) return false;
  const text = m.body.trim().toLowerCase();
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);

  // Mode DM : le bot est l'adversaire, pas besoin d'inscription
  if (state.phase === 'playing') {
    if (!['pierre', 'papier', 'ciseaux'].includes(text)) return false;
    if (state.choices.has(sender)) {
      await m.reply(`@${name}, tu as déjà choisi !`).catch(() => {});
      return true;
    }
    state.choices.set(sender, text);
    await m.reply(`✅ @${name} a choisi !`).catch(() => {});
    saveGames();
    // Le bot joue automatiquement
    const botChoice = ['pierre', 'papier', 'ciseaux'][Math.floor(Math.random() * 3)];
    state.choices.set('bot', botChoice);
    saveGames();
    clearTimeout(state.timer);
    const c1 = state.choices.get(state.challenger);
    const c2 = state.choices.get('bot');
    const w = rpsWinner(c1, c2);
    const botName = await getDisplayName(sock, 'bot@djousse.tech');
    let result = w === 0 ? 'Égalité !' : w === 1 ? `@${name} gagne ! 🎉` : `🤖 DJOUSSE TECH gagne ! 🎉`;
    await sock.sendMessage(state.chat, {
      text: `⚔️ *RÉSULTAT*\n@${name} : ${c1}\n🤖 DJOUSSE TECH : ${c2}\n${result}`,
      mentions: [sender],
    });
    activeGames.delete(state.chat);
    saveGames();
    return true;
  }

  if (state.phase === 'waiting_opponent') {
    if (text === 'je joue' || text === 'joue' || text === '1') {
      if (sender === state.challenger) { await m.reply(`@${name}, tu es déjà le challenger !`).catch(() => {}); return true; }
      if (state.opponent) { await m.reply('Un adversaire est déjà en attente.').catch(() => {}); return true; }
      state.opponent = sender;
      state.phase = 'playing';
      const cName = await getDisplayName(sock, state.challenger);
      const oName = await getDisplayName(sock, state.opponent);
      await sock.sendMessage(state.chat, {
        text: `🎮 @${cName} vs @${oName} ! Chacun envoie *pierre*, *papier* ou *ciseaux* !`,
        mentions: [state.challenger, state.opponent],
      });
      saveGames();
      clearTimeout(state.timer);
      state.timer = setTimeout(async () => {
        if (state.choices.size < 2) {
          await sock.sendMessage(state.chat, { text: '⏰ Temps écoulé, partie annulée.' });
          activeGames.delete(state.chat);
          saveGames();
        }
      }, RPS_TIMER);
      return true;
    }
    return false;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 5 : DEVINE LE MOT (GUESS)
   ═══════════════════════════════════════════════════════════════════════════ */
function createGuessState(chat, master) {
  return {
    type: 'guess', master, word: null, guesses: new Set(),
    found: false, timer: null, chat, startedBy: master, phase: 'waiting_word',
  };
}

async function guessHandleRaw(sock, m, state) {
  if (!m.body || state.phase !== 'playing') return false;
  const text = m.body.trim().toLowerCase();
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (sender === state.master) return false;
  if (state.found) { await m.reply('Le mot a déjà été trouvé !').catch(() => {}); return true; }
  if (state.guesses.has(sender)) { await m.reply(`@${name}, tu as déjà proposé !`).catch(() => {}); return true; }
  if (text === state.word) {
    state.found = true;
    clearTimeout(state.timer);
    await sock.sendMessage(state.chat, { text: `🎉 Bravo @${name} ! Le mot était *${state.word}*.`, mentions: [sender] });
    activeGames.delete(state.chat);
    saveGames();
  } else {
    state.guesses.add(sender);
    await m.reply(`❌ Non @${name}, ce n'est pas *${text}*. Essaye encore !`).catch(() => {});
    saveGames();
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 6 : PENDU (100% IA)
   ═══════════════════════════════════════════════════════════════════════════ */
function createHangmanState(chat) {
  return {
    type: 'hangman', word: null, display: [], wrongLetters: [],
    maxAttempts: 6, attempts: 0, guessedLetters: new Set(),
    timer: null, chat, startedBy: null, phase: 'playing',
  };
}

async function hangmanHandleRaw(sock, m, state) {
  if (!m.body || state.phase !== 'playing') return false;
  const letter = m.body.trim().toLowerCase();
  if (!/^[a-z]$/i.test(letter)) return false;
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (state.guessedLetters.has(letter)) {
    await m.reply(`@${name}, cette lettre a déjà été proposée.`).catch(() => {});
    return true;
  }
  state.guessedLetters.add(letter);
  if (state.word.includes(letter)) {
    for (let i = 0; i < state.word.length; i++) {
      if (state.word[i] === letter) state.display[i] = letter;
    }
    await sock.sendMessage(state.chat, {
      text: `✅ @${name}, lettre trouvée ! Mot : ${state.display.join(' ')}`,
      mentions: [sender],
    });
    if (!state.display.includes('_')) {
      await sock.sendMessage(state.chat, { text: `🎉 Bravo, le mot était *${state.word}* !` });
      activeGames.delete(state.chat);
      saveGames();
    }
  } else {
    state.attempts++;
    state.wrongLetters.push(letter);
    const remaining = state.maxAttempts - state.attempts;
    await sock.sendMessage(state.chat, {
      text: `❌ @${name}, lettre incorrecte. Plus que ${remaining} essais.\nLettres erronées : ${state.wrongLetters.join(', ')}`,
      mentions: [sender],
    });
    if (state.attempts >= state.maxAttempts) {
      await sock.sendMessage(state.chat, { text: `💀 Perdu ! Le mot était *${state.word}*.` });
      activeGames.delete(state.chat);
      saveGames();
    }
  }
  saveGames();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 7 : HISTOIRE COLLABORATIVE
   ═══════════════════════════════════════════════════════════════════════════ */
function createStoryState(chat) {
  return {
    type: 'story', story: '', contributors: new Set(),
    timer: null, chat, startedBy: null, phase: 'playing',
  };
}

async function storyHandleRaw(sock, m, state) {
  if (!m.body || state.phase !== 'playing') return false;
  const text = m.body.trim();
  if (text.length < 3) {
    await m.reply('Ajoute une phrase plus longue (min. 3 mots).').catch(() => {});
    return true;
  }
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (state.contributors.has(sender)) {
    await m.reply(`@${name}, tu as déjà participé !`).catch(() => {});
    return true;
  }
  state.story += ' ' + text;
  state.contributors.add(sender);
  await sock.sendMessage(state.chat, {
    text: `📖 @${name} a ajouté : "${text}"\n\n📖 Histoire : ${state.story}`,
    mentions: [sender],
  });
  saveGames();
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    await sock.sendMessage(state.chat, { text: `⏰ Fin de l'histoire !\n${state.story || 'Histoire vide.'}` });
    activeGames.delete(state.chat);
    saveGames();
  }, STORY_TIMER);
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 8 : VRAI OU FAUX (100% IA)
   ═══════════════════════════════════════════════════════════════════════════ */
function createTfState(chat) {
  return {
    type: 'tf', statement: null, answer: null, votes: new Map(),
    timer: null, chat, startedBy: null, phase: 'playing',
  };
}

async function tfSend(sock, state) {
  const result = await aiGenerate(state.chat, 'tf');
  state.statement = result ? result.statement : 'Affirmation indisponible';
  state.answer = result ? result.answer : true;
  state.votes = new Map();
  await sock.sendMessage(state.chat, {
    text: box('🤔 *VRAI OU FAUX*', [
      { raw: state.statement }, { blank: true },
      { raw: 'Réponds avec *vrai* ou *faux*.' },
    ]),
  });
  saveGames();
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    const vrai = [...state.votes.values()].filter(v => v === 'vrai').length;
    const faux = [...state.votes.values()].filter(v => v === 'faux').length;
    await sock.sendMessage(state.chat, {
      text: `⏰ La réponse était *${state.answer ? 'VRAI' : 'FAUX'}*.\n📊 Votes : VRAI ${vrai}, FAUX ${faux}\n\nTape *.tf* pour une nouvelle affirmation.`,
    });
    activeGames.delete(state.chat);
    saveGames();
  }, TF_TIMER);
}

async function tfHandleRaw(sock, m, state) {
  if (!m.body || state.phase !== 'playing') return false;
  const text = m.body.trim().toLowerCase();
  if (!['vrai', 'faux'].includes(text)) return false;
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (state.votes.has(sender)) {
    await m.reply(`@${name}, tu as déjà voté !`).catch(() => {});
    return true;
  }
  state.votes.set(sender, text);
  await m.reply(`✅ @${name}, vote enregistré (${text}).`).catch(() => {});
  saveGames();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 9 : DÉFI DESSIN (TEXTE)
   ═══════════════════════════════════════════════════════════════════════════ */
function createDrawState(chat, drawer) {
  return {
    type: 'draw', drawer, word: null, guesses: new Set(),
    found: false, timer: null, chat, startedBy: drawer, phase: 'waiting_word',
  };
}

async function drawHandleRaw(sock, m, state) {
  if (!m.body || state.phase !== 'playing') return false;
  const text = m.body.trim().toLowerCase();
  const sender = m.sender;
  const name = await getDisplayName(sock, sender);
  if (sender === state.drawer) return false;
  if (state.found) { await m.reply('Le mot a déjà été trouvé !').catch(() => {}); return true; }
  if (state.guesses.has(sender)) { await m.reply(`@${name}, tu as déjà proposé !`).catch(() => {}); return true; }
  if (text === state.word) {
    state.found = true;
    clearTimeout(state.timer);
    await sock.sendMessage(state.chat, { text: `🎨 Bravo @${name} ! Le mot était *${state.word}*.`, mentions: [sender] });
    activeGames.delete(state.chat);
    saveGames();
  } else {
    state.guesses.add(sender);
    await m.reply(`❌ Non @${name}, ce n'est pas *${text}*. Essaye encore !`).catch(() => {});
    saveGames();
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   JEU 10 : STATS (statistiques joueurs)
   ═══════════════════════════════════════════════════════════════════════════ */
async function buildStatsLines(state, sock) {
  const lines = [];
  const mlist = [];
  const sorted = [...state.scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    lines.push({ raw: 'Aucune donnée pour le moment.' });
  } else {
    for (let i = 0; i < Math.min(sorted.length, 10); i++) {
      const [jid, pts] = sorted[i];
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const name = await getDisplayName(sock, jid);
      lines.push({ raw: `${medal} @${typeof name === 'string' ? name : jid} — ${pts} pt(s)` });
      mlist.push(jid);
    }
  }
  return { lines, mlist };
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERCEPTION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
async function handleRawReply(sock, m) {
  const game = activeGames.get(m.chat);
  if (!game) return false;
  const { type, state } = game;
  switch (type) {
    case 'avt': return avtHandleRaw(sock, m, state);
    case 'quiz': return quizHandleRaw(sock, m, state);
    case 'wyr': return wyrHandleRaw(sock, m, state);
    case 'rps': return rpsHandleRaw(sock, m, state);
    case 'guess': return guessHandleRaw(sock, m, state);
    case 'hangman': return hangmanHandleRaw(sock, m, state);
    case 'story': return storyHandleRaw(sock, m, state);
    case 'tf': return tfHandleRaw(sock, m, state);
    case 'draw': return drawHandleRaw(sock, m, state);
    default: return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMANDES
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'quit', alias: ['stop', 'fin'], react: '⏹️',
  desc: 'Quitter le jeu en cours', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  if (!activeGames.has(m.chat)) return reply('Aucun jeu en cours.');
  activeGames.delete(m.chat);
  saveGames();
  await reply('⏹️ Jeu terminé.');
});

cmd({
  pattern: 'avt', alias: ['actionverite', 'action-verite'], react: '🎲',
  desc: 'Action ou Vérité (IA, niveau EXTREME)', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createAvtState(chat, m.sender);
  activeGames.set(chat, { type: 'avt', state, startedAt: Date.now() });
  if (m.isGroup) {
    let participants = [];
    try { const meta = await conn.groupMetadata(chat); participants = (meta.participants || []).map(p => p.id); } catch {}
    await conn.sendMessage(chat, {
      text: box('🎲 *ACTION OU VÉRITÉ — NOUVELLE PARTIE*', [
        { raw: `Lancée par ${mention(m.sender)} — niveau *${DIFFICULTY}* 🔥` },
        { blank: true }, { raw: '👉 Tape *.jouer* dans les 60 secondes pour t\'inscrire.' },
      ]),
      mentions: participants,
    });
    state.registrationTimer = setTimeout(async () => {
      if (state.phase !== 'registration') return;
      state.phase = 'round';
      if (state.registered.size === 0) {
        await conn.sendMessage(chat, { text: '😴 Personne ne s\'est inscrit — réponds *action* ou *vérité* pour jouer !' }).catch(() => {});
      }
      await avtSendRound(conn, state);
    }, REGISTRATION_MS);
  } else {
    // Discussion privée : le lanceur est automatiquement inscrit, pas d'inscription
    state.registered.add(m.sender);
    state.phase = 'round';
    await conn.sendMessage(chat, {
      text: box('🎲 *ACTION OU VÉRITÉ — DISCUSSION PRIVÉE*', [
        { raw: `Niveau *${DIFFICULTY}* 🔥` },
        { blank: true }, { raw: '👉 Réponds *action* ou *vérité* pour recevoir ton défi.' },
      ]),
    });
    await avtSendRound(conn, state);
  }
  saveGames();
});

cmd({
  pattern: 'jouer', alias: ['rejoindre'], react: '✋',
  desc: 'S\'inscrire à la partie AVT', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const game = activeGames.get(m.chat);
  if (!game || game.type !== 'avt') return reply('❌ Aucune partie AVT en cours.');
  const state = game.state;
  const name = await getDisplayName(conn, m.sender);
  if (state.registered.has(m.sender)) return reply(`✅ @${name}, tu es déjà inscrit.`);
  state.registered.add(m.sender);
  reply(`✅ @${name} inscrit ! ${state.phase === 'registration' ? 'La manche démarre bientôt.' : 'Tu comptes au prochain tour.'}`);
  saveGames();
});

cmd({
  pattern: 'quiz', alias: ['quizz'], react: '📚',
  desc: 'Quiz à choix multiples (100% IA)', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createQuizState(chat);
  state.startedBy = m.sender;
  activeGames.set(chat, { type: 'quiz', state, startedAt: Date.now() });
  await reply('🎯 *QUIZ DÉMARRÉ !* 10 questions IA — réponds A, B, C ou D.');
  await quizSendQuestion(conn, state);
  saveGames();
});

cmd({
  pattern: 'wyr', alias: ['wouldyourather', 'ou'], react: '🤔',
  desc: 'Would You Rather (100% IA)', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createWyrState(chat);
  state.startedBy = m.sender;
  activeGames.set(chat, { type: 'wyr', state, startedAt: Date.now() });
  await reply('🎭 *WOULD YOU RATHER — vote 1 ou 2 !*');
  await wyrSend(conn, state);
  saveGames();
});

cmd({
  pattern: 'rps', alias: ['pierre-papier-ciseaux', 'chifoumi'], react: '✊',
  desc: 'Pierre-Papier-Ciseaux — "je joue" pour rejoindre (DM : le bot joue contre toi)', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const isDM = !m.isGroup;
  const state = createRpsState(chat, m.sender);
  activeGames.set(chat, { type: 'rps', state, startedAt: Date.now() });
  const name = await getDisplayName(conn, m.sender);

  if (isDM) {
    // Discussion privée : le bot est l'adversaire
    state.phase = 'playing';
    await conn.sendMessage(chat, {
      text: `✊ *PIERRE-PAPIER-CISEAUX* (DM)\n@${name} vs 🤖 DJOUSSE TECH !\nEnvoie *pierre*, *papier* ou *ciseaux* pour jouer.`,
      mentions: [m.sender],
    });
    saveGames();
    return;
  }

  await reply(`✊ *PIERRE-PAPIER-CISEAUX*\n@${name} défie tout le monde ! Envoie "je joue" pour rejoindre.`, [m.sender]);
  state.timer = setTimeout(async () => {
    if (state.phase === 'waiting_opponent') {
      await conn.sendMessage(chat, { text: '⏰ Personne n\'a rejoint, partie annulée.' });
      activeGames.delete(chat);
      saveGames();
    }
  }, RPS_TIMER);
  saveGames();
});

cmd({
  pattern: 'guess', alias: ['devine'], react: '🔍',
  desc: 'Devine le mot — .word <mot> pour définir', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createGuessState(chat, m.sender);
  activeGames.set(chat, { type: 'guess', state, startedAt: Date.now() });
  const name = await getDisplayName(conn, m.sender);
  await reply(`🔍 *DEVINE LE MOT* — @${name} va penser à un mot.\n@${name} : envoie *.word <mot>* pour le définir.`, [m.sender]);
  saveGames();
});

cmd({
  pattern: 'hangman', alias: ['pendu'], react: '🪢',
  desc: 'Pendu — mot généré par IA', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  await reply('🪢 *PENDU* — Génération du mot par IA...');
  const result = await aiGenerate(chat, 'hangman');
  let word = result ? result.word : '';
  if (!word || word.length < 4) word = 'ordinateur';
  const state = createHangmanState(chat);
  state.word = word;
  state.display = word.split('').map(() => '_');
  state.startedBy = m.sender;
  activeGames.set(chat, { type: 'hangman', state, startedAt: Date.now() });
  await conn.sendMessage(chat, {
    text: box('🪢 *PENDU*', [
      { raw: `Mot de *${word.length}* lettres : ${state.display.join(' ')}` },
      { blank: true },
      { raw: 'Envoie une lettre pour proposer.' },
    ]),
  });
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    if (state.phase === 'playing') {
      await conn.sendMessage(chat, { text: `⏰ Le mot était *${state.word}*.` });
      activeGames.delete(chat);
      saveGames();
    }
  }, HANGMAN_TIMER);
  saveGames();
});

cmd({
  pattern: 'story', alias: ['histoire'], react: '📖',
  desc: 'Histoire collaborative — chacun ajoute une phrase', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createStoryState(chat);
  state.startedBy = m.sender;
  activeGames.set(chat, { type: 'story', state, startedAt: Date.now() });
  await reply('📖 *HISTOIRE COLLABORATIVE* — Envoyez une phrase pour commencer !');
  state.timer = setTimeout(async () => {
    await conn.sendMessage(chat, { text: `⏰ Fin de l'histoire !\n${state.story || 'Histoire vide.'}` });
    activeGames.delete(chat);
    saveGames();
  }, STORY_TIMER);
  saveGames();
});

cmd({
  pattern: 'tf', alias: ['vraifaux', 'truefalse'], react: '🤨',
  desc: 'Vrai ou Faux (100% IA)', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createTfState(chat);
  state.startedBy = m.sender;
  activeGames.set(chat, { type: 'tf', state, startedAt: Date.now() });
  await reply('🤨 *VRAI OU FAUX* — Génération de l\'affirmation par IA...');
  await tfSend(conn, state);
  saveGames();
});

cmd({
  pattern: 'draw', alias: ['dessin', 'pictionary'], react: '🎨',
  desc: 'Dessin texte — .word <mot> pour définir', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (activeGames.has(chat)) return reply('⚠️ Un jeu est déjà en cours. Tape *.quit* pour le terminer.');
  const state = createDrawState(chat, m.sender);
  activeGames.set(chat, { type: 'draw', state, startedAt: Date.now() });
  const name = await getDisplayName(conn, m.sender);
  await reply(`🎨 *DÉFI DESSIN* — @${name} va choisir un mot.\n@${name} : envoie *.word <mot>* pour le définir.`, [m.sender]);
  saveGames();
});

cmd({
  pattern: 'word', alias: ['mot'], react: '📝',
  desc: 'Définir le mot pour .guess ou .draw', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const game = activeGames.get(m.chat);
  if (!game) return reply('Aucun jeu nécessitant un mot en cours.');
  const { type, state } = game;
  const name = await getDisplayName(conn, m.sender);
  const word = m.body?.trim()?.split(' ').slice(1).join(' ');
  if (!word) return reply('Utilise : .word <mot>');

  if (type === 'guess') {
    if (m.sender !== state.master) return reply(`@${name}, seul le lanceur peut définir le mot.`);
    if (state.phase !== 'waiting_word') return reply('Le mot a déjà été défini.');
    state.word = word.toLowerCase();
    state.phase = 'playing';
    await reply(`✅ @${name}, mot enregistré ! Les joueurs peuvent proposer.`);
    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      if (!state.found) {
        await conn.sendMessage(m.chat, { text: `⏰ Le mot était *${state.word}*.` });
        activeGames.delete(m.chat);
        saveGames();
      }
    }, GUESS_TIMER);
    saveGames();
    return;
  }

  if (type === 'draw') {
    if (m.sender !== state.drawer) return reply(`@${name}, seul le dessinateur peut définir le mot.`);
    if (state.phase !== 'waiting_word') return reply('Le mot a déjà été défini.');
    state.word = word.toLowerCase();
    state.phase = 'playing';
    await reply(`✅ @${name}, mot enregistré ! Les autres joueurs peuvent proposer.`);
    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      if (!state.found) {
        await conn.sendMessage(m.chat, { text: `⏰ Le mot était *${state.word}*.` });
        activeGames.delete(m.chat);
        saveGames();
      }
    }, DRAW_TIMER);
    saveGames();
    return;
  }

  reply('Commande .word non applicable pour ce jeu.');
});

cmd({
  pattern: 'leaderboard', alias: ['classement', 'score'], react: '🏆',
  desc: 'Afficher les stats de la partie en cours', category: 'game', filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const game = activeGames.get(m.chat);
  if (!game) return reply('Aucun jeu en cours.');
  const { type, state } = game;
  const lines = [];
  const mlist = [];
  const sorted = [...state.scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) lines.push({ raw: 'Aucun score pour le moment.' });
  else {
    for (let i = 0; i < Math.min(sorted.length, 10); i++) {
      const [jid, pts] = sorted[i];
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const name = await getDisplayName(conn, jid);
      lines.push({ raw: `${medal} @${name} — ${pts} pt(s)` });
      mlist.push(jid);
    }
  }
  await conn.sendMessage(m.chat, {
    text: box(`🏆 *CLASSEMENT — ${type.toUpperCase()}*`, lines),
    mentions: mlist,
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURATION AU DÉMARRAGE
   ═══════════════════════════════════════════════════════════════════════════ */
(function restoreGames() {
  try {
    usedQuestionsCache = loadUsed();
    const saved = loadGames();
    const now = Date.now();
    for (const [chatId, data] of Object.entries(saved)) {
      if (!data || !data.state) continue;
      const age = now - (data.lastUpdate || 0);
      if (age > 24 * 60 * 60 * 1000) continue;
      const state = deserializeState(data.state, data.type);
      state.chat = chatId;
      activeGames.set(chatId, { type: data.type, state, startedAt: data.startedAt || data.lastUpdate });
    }
    if (Object.keys(saved).length) {
      console.log(`🎮 ${Object.keys(saved).length} partie(s) restaurée(s) depuis games_data.json`);
    }
  } catch {}
})();

/* ═══════════════════════════════════════════════════════════════════════════
   AUTO-SAVE PÉRIODIQUE (toutes les 60s)
   ═══════════════════════════════════════════════════════════════════════════ */
setInterval(() => {
  if (activeGames.size > 0) saveGames();
}, 60000);

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
module.exports = { handleRawReply };
