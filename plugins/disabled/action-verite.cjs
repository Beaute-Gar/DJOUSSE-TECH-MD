'use strict';

const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');
const ai = require('../lib/ai.cjs');
const voice = require('../lib/voice.cjs');
const { withTimeout } = require('../lib/withTimeout.cjs');

const PREFIX = config.PREFIX || '.';

const ENV = {
  ROUND_MS: parseInt(process.env.AV_ROUND_MS || '300000', 10),
  CHOOSE_MS: parseInt(process.env.AV_CHOOSE_MS || '90000', 10),
  MAX_JOKERS: parseInt(process.env.AV_MAX_JOKERS || '2', 10),
  MAX_PLAYERS: parseInt(process.env.AV_MAX_PLAYERS || '8', 10),
  MIN_GROUP: parseInt(process.env.AV_MIN_GROUP || '2', 10),
  WITNESS: (process.env.AV_WITNESS || '1') === '1',
  VOICE_RULES: (process.env.AV_VOICE_RULES || '0') === '1',
};

const LEVELS = {
  soft: {
    emoji: '🌿', label: 'SOFT',
    desc: 'familial, fun, adapté à tous (ados inclus)',
    constraint: "Rien d'embarrassant ni d'intime. Convient aux adolescents et à la famille.",
  },
  pimente: {
    emoji: '🌶️', label: 'PIMENTÉ',
    desc: 'soirée adultes, audacieux',
    constraint: "Audacieux et provocant, MAIS toujours respectueux : pas d'humiliation ni de pression.",
  },
  extreme: {
    emoji: '🔥', label: 'EXTREME',
    desc: 'très osé, adultes consentants',
    constraint: "Très osé et intime, uniquement entre adultes consentants. Interdit : illégal, violent, dégradant, exposition de numéros ou d'accès.",
  },
  couple: {
    emoji: '💞', label: 'COUPLE',
    desc: 'romantique & intime, à deux',
    constraint: "Orienté couple/relation : questions et défis tendres, romantiques ou intimes entre partenaires.",
  },
};

const LEVEL_KEYS = Object.keys(LEVELS);

const OTHER_GAMES = [
  { name: '🔄 Tu préfères', desc: 'Deux choix — lequel tu prends ?', rules: '1) Le bot balance un dilemme. 2) Chacun répond son choix. 3) Le groupe réagit au plus drôle.' },
  { name: "🍺 Je n'ai jamais", desc: 'Qui a déjà fait des choses improbables ?', rules: '1) Une affirmation est lue. 2) Ceux qui l\u2019ont déjà faite marquent un point. 3) Le plus de points gagne.' },
  { name: '🤔 Qui est le plus susceptible de…', desc: 'Montre du doigt la personne la plus susceptible de…', rules: '1) Question posée au groupe. 2) Chacun désigne quelqu\u2019un. 3) Le plus désigné marque le point.' },
  { name: '👑 Kings Cup', desc: 'Les règles du roi — piochez, suivez la règle.', rules: '1) Pioche une carte. 2) Applique sa règle. 3) Le roi (dernier K) impose le gage.' },
  { name: '✌️ Deux vérités, un mensonge', desc: 'Pouvez-vous repérer le mensonge ?', rules: '1) Un joueur donne 2 vérités + 1 mensonge. 2) Les autres votent. 3) Ceux qui trouvent gagnent.' },
  { name: '🕵️ Imposteur', desc: "Trouvez l'espion : un seul ne connaît pas le mot secret.", rules: '1) Un mot secret est donné à tous sauf un. 2) L\u2019imposteur doit se fondre. 3) Votez pour le démasquer.' },
  { name: '🔥 Siège chaud', desc: 'Un joueur sur la sellette — le groupe le questionne.', rules: '1) Un volontaire au siège. 2) Le groupe pose les questions. 3) Réponds honnêtement ou passe.' },
  { name: '🎭 Charades', desc: 'Mime un mot, les autres devinent.', rules: '1) Un mot secret. 2) Mime-le sans parler. 3) Le groupe devine avant la fin du chrono.' },
];

const sessions = new Map();

function numOf(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function mentionsText(ids) {
  return (ids || []).map(id => '@' + numOf(id)).join(' ');
}

async function sendText(conn, jid, text, ids, quoted) {
  return conn.sendMessage(jid, {
    text,
    contextInfo: ids && ids.length ? { mentionedJid: ids } : undefined,
  }, quoted ? { quoted } : undefined);
}

async function groupMembers(conn, jid) {
  const meta = await conn.groupMetadata(jid).catch(() => null);
  if (!meta || !Array.isArray(meta.participants)) return [];
  return meta.participants.map(p => ({ id: p.id, name: String(p.name || '').trim(), admin: !!p.admin }));
}

function botNum(conn) {
  const u = conn && conn.user;
  if (!u || !u.id) return null;
  return String(u.id).split(':')[0].split('@')[0];
}

function get(jid) {
  return sessions.get(jid);
}

function create(jid, host, name, level) {
  const s = {
    jid, host, level,
    phase: 'open', round: 0,
    players: new Map(), questions: new Map(),
    used: [], members: [],
    turnEndsAt: 0, chooseUntil: 0,
    timers: new Map(),
  };
  sessions.set(jid, s);
  return s;
}

function clearTimer(s) {
  const t = s.timers.get('turn');
  if (t) { clearTimeout(t); s.timers.delete('turn'); }
}

function rulesText(level) {
  const l = LEVELS[level] || LEVELS.soft;
  const base = {
    soft: '✅ Vérité = réponds honnêtement. 🎯 Action = relève le défi. Pas de gage alcool demandé : les points suffisent !',
    pimente: '✅ Vérité = ose répondre. 🎯 Action = challenge audacieux mais respectueux. 🚫 Passe = joker (2 max).',
    extreme: '✅ +18 strict et consentement absolu. 🚫 Rien d\u2019illégal, de violent ni d\u2019humiliant. 🚫 Passe = joker (2 max), refus sans joker = -5 pts.',
    couple: '✅ Questions et défis orientés couple. 💞 Le reste du groupe observe et vote si besoin.',
  }[level] || '';
  return `${l.emoji} *Règles ${l.label}* — ${base}`;
}

async function speakRules(conn, jid, level) {
  if (!ENV.VOICE_RULES) return;
  try {
    const mp3 = await voice.generateTts(rulesText(level).replace(/\*/g, ''));
    if (mp3) {
      const vn = voice.mp3ToVoiceNote(mp3);
      if (vn) {
        await conn.sendMessage(jid, { audio: vn.audio, mimetype: vn.mimetype, ptt: true, seconds: vn.seconds });
        return true;
      }
    }
  } catch { /* texte par défaut */ }
  return false;
}

function genSystem(level, used) {
  const l = LEVELS[level] || LEVELS.soft;
  return [
    'Tu es le maître de jeu du jeu WhatsApp « Action ou Vérité ». Tu réponds TOUJOURS en français.',
    'Tu génères UNE SEULE question ou action, d\u2019une seule phrase, sans guillemets, sans numéro, sans préfixe ni explication.',
    `Niveau actuel : ${l.label} — ${l.desc}.`,
    l.constraint,
    'Sécurité absolue : rien d\u2019illégal, rien de violent, rien d\u2019humiliant ou dangereux, rien d\u2019explicite (le groupe peut contenir des adolescents).',
    used.length ? `Ne répète JAMAIS ces questions déjà posées : ${used.slice(-10).join(' | ')}.` : '',
    'Pour une ACTION : elle doit être réalisable en moins de 5 minutes DEPUIS WhatsApp (vocal, message, sticker, photo, statut, PP, imiter, chanter, défier un membre du groupe) et impliquer si possible un autre membre du groupe.',
    'Retourne UNIQUEMENT la question ou l\u2019action générée.',
  ].filter(Boolean).join(' ');
}

async function genQuestion(level, type, name, used, partner) {
  try {
    const system = genSystem(level, used || []);
    const user = `Génère ${type === 'V' ? 'une VÉRITÉ' : 'une ACTION'} pour ${name}${partner ? ' avec ' + partner : ''}.`;
    const r = await withTimeout(ai.chatSystem(system, user, { temperature: 1 }), 30000, 'IA_action_verite');
    const t = String(r || '').trim().replace(/^["']+|["']+$/g, '');
    return t && t.length < 400 ? t : null;
  } catch (e) {
    return null;
  }
}

function pickWitness(conn, session, actor) {
  const candidates = session.members.filter(p => {
    if (!p.id || p.id === actor) return false;
    if (numOf(p.id) === botNum(conn)) return false;
    for (const r of session.questions.values()) {
      if (r.witness && numOf(r.witness) === numOf(p.id)) return false;
    }
    return true;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

function pickPartner(session, actor) {
  const others = session.members.filter(p => p.id && p.id !== actor);
  if (!others.length) return null;
  return others[Math.floor(Math.random() * others.length)].name;
}

async function announce(conn, m, session) {
  const jid = m.chat;
  if (m.isGroup) session.members = await groupMembers(conn, jid);
  else session.members = [{ id: m.sender, name: '' }];
  const all = session.members.filter(p => p.id).map(p => p.id);
  const lvl = LEVELS[session.level];
  const text = [
    `🎮 *ACTION OU VÉRITÉ* 🎮`,
    ``,
    `👑 ${m.pushName || '@' + numOf(m.sender)} lance une partie en *${lvl.emoji} ${lvl.label}* !`,
    `📣 ${mentionsText(all)} — vous êtes tous invités !`,
    ``,
    `✍️ S\u2019inscrire pour jouer : ${PREFIX}av join`,
    `▶️ Lancer le ${session.round + 1}e tour : ${PREFIX}av go`,
    `❓ Vérité : ${PREFIX}av v   🎯 Action : ${PREFIX}av a`,
    `✅ Réalisé : ${PREFIX}av fait   🚫 Passer : ${PREFIX}av passe`,
    `📊 Scores : ${PREFIX}av stats   🛑 Arrêter : ${PREFIX}av stop`,
    ``,
    `⏱️ Chaque tour dure ~${Math.round(ENV.ROUND_MS / 60000)} min.`,
  ].join('\n');
  await sendText(conn, jid, text, all, m);
}

async function start(conn, m, wantedLevel) {
  const jid = m.chat;
  let s = get(jid);
  if (s && s.phase !== 'ended') {
    await sendText(conn, jid, '🎮 Une partie est déjà en cours ici — réponds ' + PREFIX + 'av stats pour voir où on en est.', null, m);
    return;
  }
  const level = wantedLevel && LEVELS[wantedLevel] ? wantedLevel : LEVEL_KEYS[Math.floor(Math.random() * LEVEL_KEYS.length)];
  if (!s) s = create(jid, m.sender, m.pushName || numOf(m.sender), level);
  else { s.level = level; s.used = []; s.round = 0; s.players.clear(); s.questions.clear(); }
  s.phase = 'open';

  if (m.isGroup) {
    const members = await groupMembers(conn, jid);
    if (members.length < ENV.MIN_GROUP) {
      await sendText(conn, jid, '⚠️ Il faut au moins ' + ENV.MIN_GROUP + ' membres dans le groupe pour lancer une partie.', null, m);
      sessions.delete(jid);
      return;
    }
  }
  await announce(conn, m, s);
}

async function join(conn, m, session) {
  const actor = m.sender;
  const jid = m.chat;
  if (!session) {
    await sendText(conn, jid, '🎮 Aucune partie en cours — lance un jeu avec ' + PREFIX + 'av.', null, m);
    return;
  }
  if (session.players.has(actor)) {
    if (m.react) m.react('🙋').catch(() => {});
    return;
  }
  if (session.players.size >= ENV.MAX_PLAYERS) {
    await sendText(conn, jid, '⛔ Partie complète (' + ENV.MAX_PLAYERS + ' joueurs max).', null, m);
    return;
  }
  const name = m.pushName || numOf(actor);
  session.players.set(actor, {
    name, score: 0, roundScore: 0, jokers: ENV.MAX_JOKERS,
    done: false, chosen: false, status: 'idle',
  });
  if (m.react) m.react('👍').catch(() => {});
  await sendText(conn, jid, `🙋 @${numOf(actor)} s\u2019inscrit !\n\nJoueurs (${session.players.size}) :\n${[...session.players.values()].map(p => '• ' + p.name).join('\n')}`, [actor], m);
}

async function startTurn(conn, m, session) {
  const jid = session.jid;
  if (!session.players.size) {
    await sendText(conn, jid, '🙈 Aucun joueur inscrit. Réponds ' + PREFIX + 'av join pour jouer.', null, m);
    return;
  }
  if (m && m.isGroup && session.players.size < ENV.MIN_GROUP) {
    await sendText(conn, jid, `⚠️ Il faut au moins ${ENV.MIN_GROUP} joueurs inscrits. Encore ${ENV.MIN_GROUP - session.players.size} inscrit(s) (${PREFIX}av join).`, null, m);
    return;
  }
  session.round += 1;
  session.phase = 'choosing';
  session.questions.clear();
  for (const pl of session.players.values()) {
    pl.roundScore = 0; pl.jokers = ENV.MAX_JOKERS;
    pl.done = false; pl.chosen = false; pl.status = 'idle';
  }
  clearTimer(session);
  session.turnEndsAt = Date.now() + ENV.ROUND_MS;
  session.chooseUntil = Date.now() + ENV.CHOOSE_MS;
  const ids = [...session.players.keys()];
  const lvl = LEVELS[session.level];
  await sendText(conn, jid, `🎮 *TOUR ${session.round}* · Niveau *${lvl.emoji} ${lvl.label}*\n\n${mentionsText(ids)}, choisissez !\n\n❓ *VÉRITÉ* → ${PREFIX}av v\n🎯 *ACTION* → ${PREFIX}av a\n\n⏱️ Tour d\u2019environ ${Math.round(ENV.ROUND_MS / 60000)} min — sans réponse : -5 pts.`, ids, m);
  if (m && m.react) m.react('🎲').catch(() => {});
  const timer = setTimeout(() => endTurn(conn, session), ENV.ROUND_MS);
  if (timer.unref) timer.unref();
  session.timers.set('turn', timer);
}

async function choose(conn, m, session, type) {
  const actor = m.sender;
  const pl = session.players.get(actor);
  if (!pl) {
    await sendText(conn, session.jid,
      `🔒 @${numOf(actor)}, tu n\u2019es pas inscrit(e) !\nPour être compté(e) au PROCHAIN TOUR : ${PREFIX}av join\n(En attendant, tu peux participer aux actions des autres 👀)`, [actor], m);
    return;
  }
  if (pl.chosen) {
    if (m.react) m.react('⏳').catch(() => {});
    return;
  }
  pl.chosen = true;
  pl.status = 'assigned';
  if (m.react) m.react(type === 'V' ? '❓' : '🎯').catch(() => {});
  const partner = session.level === 'couple' ? pickPartner(session, actor) : null;
  const q = await genQuestion(session.level, type, pl.name, session.used.slice(-10), partner);
  if (!q) {
    pl.chosen = false;
    pl.status = 'idle';
    await sendText(conn, session.jid, `🤖 IA indisponible pour générer ta question… Réessaie : ${PREFIX}av ${type === 'V' ? 'v' : 'a'}`, [actor], m);
    return;
  }
  session.used.push(q);
  const rec = { type, text: q, witness: null, done: false, passed: false, points: type === 'V' ? 10 : 15 };
  if (ENV.WITNESS && session.members.length > 1) {
    const w = pickWitness(conn, session, actor);
    if (w) rec.witness = w;
  }
  session.questions.set(actor, rec);
  const kind = type === 'V' ? '❓ *VÉRITÉ*' : '🎯 *ACTION*';
  let mes = `${mentionsText([actor])}, à toi !\n\n${kind} : ${q}\n\n✅ Réalisé → ${PREFIX}av fait\n🚫 Passer → ${PREFIX}av passe (joker ${pl.jokers})`;
  const ids = [actor];
  if (rec.witness) {
    mes += `\n🤝 ${mentionsText([rec.witness])}, tu valides avec ${PREFIX}av ok`;
    ids.push(rec.witness);
  }
  await sendText(conn, session.jid, mes, ids, m);
}

async function creditDone(conn, session, actor) {
  const rec = session.questions.get(actor);
  const pl = session.players.get(actor);
  if (!rec || !pl || rec.done) return;
  rec.done = true;
  pl.done = true;
  pl.status = 'done';
  const pts = rec.points + (session.level === 'couple' ? 2 : 0);
  pl.roundScore += pts;
  pl.score += pts;
  await sendText(conn, session.jid, `✅ @${numOf(actor)} a réalisé ${rec.type === 'V' ? 'sa *VÉRITÉ*' : 'son *ACTION*'} (+${pts} pts) !`, [actor]);
  await maybeEndTurn(conn, session);
}

async function creditPass(conn, session, actor) {
  const rec = session.questions.get(actor);
  const pl = session.players.get(actor);
  if (!rec || !pl || rec.done) return;
  rec.done = true;
  rec.passed = true;
  pl.done = true;
  if (pl.jokers > 0) {
    pl.jokers -= 1;
    pl.status = 'passed';
    await sendText(conn, session.jid, `🚫 @${numOf(actor)} passe (joker ${pl.jokers} restant) — 0 pt`, [actor]);
  } else {
    pl.roundScore -= 5;
    pl.score -= 5;
    pl.status = 'missed';
    await sendText(conn, session.jid, `⛔ @${numOf(actor)} refuse sans joker — **-5 pts**`, [actor]);
  }
  await maybeEndTurn(conn, session);
}

async function confirmDone(conn, m, session) {
  const actor = m.sender;
  const rec = session.questions.get(actor);
  if (!rec || rec.done) {
    if (m.react) m.react('😅').catch(() => {});
    return;
  }
  if (rec.witness) {
    await sendText(conn, session.jid, `🤝 @${numOf(actor)} dit avoir réalisé.\n@${numOf(rec.witness)}, valide avec ${PREFIX}av ok — ou @${numOf(actor)} passe avec ${PREFIX}av passe.`, [actor, rec.witness], m);
    if (m.react) m.react('⏳').catch(() => {});
    return;
  }
  await creditDone(conn, session, actor);
}

async function confirmWitness(conn, m, session) {
  let found = null;
  for (const [act, rec] of session.questions.entries()) {
    if (rec.witness && numOf(rec.witness) === numOf(m.sender)) { found = act; break; }
  }
  if (!found) {
    if (m.react) m.react('🤷').catch(() => {});
    return;
  }
  if (m.react) m.react('✅').catch(() => {});
  await creditDone(conn, session, found);
}

async function maybeEndTurn(conn, session) {
  if (session.phase !== 'choosing') return;
  if (!session.players.size) return;
  for (const pl of session.players.values()) {
    if (!pl.done) return;
  }
  await endTurn(conn, session);
}

async function postStats(conn, session) {
  const jid = session.jid;
  const list = [...session.players.values()].sort((a, b) => b.score - a.score);
  const roundBest = [...session.players.entries()].sort((a, b) => b[1].roundScore - a[1].roundScore)[0];
  const totalPoints = list.reduce((t, p) => t + p.score, 0);
  const lines = [];
  if (list.length === 0) {
    await sendText(conn, jid, '📊 Aucun joueur enregistré pour le moment.');
    return;
  }
  for (const [i, p] of list.entries()) {
    const badge = i === 0 ? '👑 ' : (i === 1 ? '🥈 ' : (i === 2 ? '🥉 ' : ''));
    lines.push(`${badge}${p.name} — **${p.score} pts** (${p.roundScore} ce tour)`);
  }
  if (!ENV.WITNESS) {
    lines.push('');
    lines.push('🤝 Le témoin est désactivé (AV_WITNESS=0) : chaque joueur valide sa propre réalisation.');
  }
  await sendText(conn, jid, box('📊 *CLASSEMENT*', [
    { raw: lines.join('\n') },
    { blank: true },
    { raw: `Total : ${totalPoints} pts sur ${session.round} tour(s)` },
  ]));
}

async function proposeNext(conn, session) {
  const ranked = [...session.players.entries()].sort((a, b) => b[1].score - a[1].score);
  const best = ranked[0] ? ranked[0][1] : null;
  const roundRanked = [...session.players.entries()].sort((a, b) => b[1].roundScore - a[1].roundScore);
  const roundBest = roundRanked[0] ? roundRanked[0] : null;
  let txt = `🏁 *Tour ${session.round} terminé !*\n\n`;
  if (roundBest && roundBest[1].roundScore > 0) {
    txt += `🏆 *Meilleur du tour* : ${roundBest[1].name} — **${roundBest[1].roundScore} pts**\n`;
  }
  if (best && best.score > 0) {
    txt += `👑 *Leader général* : ${best.name} — **${best.score} pts**\n`;
  } else {
    txt += '👀 Personne n\u2019a encore marqué de point — osez !\n';
  }
  txt += `\n🎲 La suite :\n▶️ Toujours Action ou Vérité → ${PREFIX}av go\n🎲 Un autre jeu → ${PREFIX}av other\n🛑 Arrêter → ${PREFIX}av stop`;
  await sendText(conn, session.jid, txt);
}

async function endTurn(conn, session) {
  if (session.phase === 'results') return;
  clearTimer(session);
  session.phase = 'results';
  for (const [actor, rec] of session.questions.entries()) {
    if (rec.done) continue;
    const pl = session.players.get(actor);
    if (!pl) continue;
    pl.status = 'missed';
    pl.roundScore -= 5;
    pl.score -= 5;
  }
  await postStats(conn, session);
  await proposeNext(conn, session);
}

async function stopGame(conn, m, session) {
  clearTimer(session);
  session.phase = 'ended';
  await postStats(conn, session);
  await sendText(conn, session.jid, `🛑 Partie terminée. Merci d\u2019avoir joué !\nPour une nouvelle partie : ${PREFIX}av\n(Un autre jeu ? ${PREFIX}av other)`, null, m);
}

async function proposeOther(conn, m, session) {
  const g = OTHER_GAMES[Math.floor(Math.random() * OTHER_GAMES.length)];
  const txt = `🎲 *Autre jeu proposé*\n\n*${g.name}*\n${g.desc}\n\n{PLACEHOLDER_RULES}`;
  const rules = `📜 Mini-règles :\n${g.rules}\n\n👉 Prêt ? On lance ${PREFIX}av pour une nouvelle partie, ou ${PREFIX}av stop pour arrêter.`;
  await sendText(conn, m.chat, txt.replace('{PLACEHOLDER_RULES}', rules), null, m);
  if (ENV.VOICE_RULES) await speakRules(conn, m.chat, session && session.level ? session.level : 'soft').catch(() => {});
}

async function showHelp(conn, m) {
  await sendText(conn, m.chat, box('🎮 *ACTION OU VÉRITÉ*', [
    { raw: 'Jeu coordonné, 100% généré par IA (niveau aléatoire : 🌿 Soft, 🌶️ Pimenté, 🔥 Extrême, 💞 Couple).' },
    { blank: true },
    { raw: `🆕 Lancer/annoncer : ${PREFIX}av` },
    { raw: `✍️ S\u2019inscrire : ${PREFIX}av join` },
    { raw: `▶️ Lancer le tour (5 min) : ${PREFIX}av go` },
    { raw: `❓ Choisir VÉRITÉ : ${PREFIX}av v` },
    { raw: `🎯 Choisir ACTION : ${PREFIX}av a` },
    { raw: `✅ Réalisé : ${PREFIX}av fait` },
    { raw: `🤝 Valider (témoin) : ${PREFIX}av ok` },
    { raw: `🚫 Passer : ${PREFIX}av passe` },
    { raw: `📊 Scores : ${PREFIX}av stats` },
    { raw: `🎲 Autre jeu : ${PREFIX}av other` },
    { raw: `🛑 Arrêter : ${PREFIX}av stop` },
    { blank: true },
    { raw: 'Var. env : AV_ROUND_MS, AV_CHOOSE_MS, AV_MAX_JOKERS, AV_MAX_PLAYERS, AV_WITNESS, AV_VOICE_RULES.' },
  ]), null, m);
}

cmd({
  pattern: 'av',
  alias: ['actionverite', 'tord'],
  react: '🎮',
  desc: 'Jeu Action ou Vérité coordonné (IA + scores + tours de 5 min)',
  category: 'game',
  filename: __filename,
}, async (conn, m) => {
  if (!m || !m.sender) return;
  if (m.fromMe) return;

  const raw = String(m.body || '').slice(PREFIX.length).trim();
  const parts = raw.split(/\s+/);
  const sub = (parts[0] || '').toLowerCase();
  const extra = (parts.slice(1).join(' ')).trim().toLowerCase();
  const jid = m.chat;
  const hasSession = sessions.has(jid);

  if (!sub || sub === 'start' || sub === 'new' || sub === 'lancer' || sub === 'commencer') {
    const wanted = LEVEL_KEYS.find(k => extra.includes(k) || (k === 'pimente' && extra.includes('piment')) || (k === 'couple' && extra.includes('couple')));
    return start(conn, m, wanted);
  }

  const session = get(jid);
  if (!session) {
    return sendText(conn, jid, '🎮 Aucune partie en cours ici — lance un jeu avec ' + PREFIX + 'av.', null, m);
  }

  if (sub === 'join' || sub === 'j' || sub === 'inscris' || sub === 'inscription') return join(conn, m, session);
  if (sub === 'go' || sub === 'demarrer' || sub === 'startr' || sub === 'play') {
    if (session.phase === 'choosing') {
      return sendText(conn, jid, '⏳ Un tour est déjà en cours, réponds ' + PREFIX + 'av v / ' + PREFIX + 'av a.', null, m);
    }
    return startTurn(conn, m, session);
  }
  if (sub === 'v' || sub === 'verite' || sub === 'vérité' || sub === 'truth') {
    if (session.phase !== 'choosing' && session.phase !== 'playing') {
      return sendText(conn, jid, '▶️ Aucun tour en cours — lance avec ' + PREFIX + 'av go.', null, m);
    }
    return choose(conn, m, session, 'V');
  }
  if (sub === 'a' || sub === 'action' || sub === 'dare') {
    if (session.phase !== 'choosing' && session.phase !== 'playing') {
      return sendText(conn, jid, '▶️ Aucun tour en cours — lance avec ' + PREFIX + 'av go.', null, m);
    }
    return choose(conn, m, session, 'A');
  }
  if (sub === 'fait' || sub === 'done' || sub === 'termine') return confirmDone(conn, m, session);
  if (sub === 'ok' || sub === 'confirm') return confirmWitness(conn, m, session);
  if (sub === 'passe' || sub === 'pass' || sub === 'passer') {
    const pl = session.players.get(m.sender);
    if (!pl) return sendText(conn, jid, '🔒 @' + numOf(m.sender) + ', pas inscrit(e) — ' + PREFIX + 'av join pour le prochain tour.', [m.sender], m);
    const rec = session.questions.get(m.sender);
    if (!rec || rec.done) return m.react('😅').catch(() => {});
    return creditPass(conn, session, m.sender);
  }
  if (sub === 'stats' || sub === 'score' || sub === 'scores') return postStats(conn, session);
  if (sub === 'stop' || sub === 'fin' || sub === 'end' || sub === 'arreter' || sub === 'arrêter') return stopGame(conn, m, session);
  if (sub === 'other' || sub === 'jeu' || sub === 'autre' || sub === 'change') return proposeOther(conn, m, session);
  if (sub === 'help' || sub === 'aide' || sub === 'regles' || sub === '?' || sub === 'menu') return showHelp(conn, m);

  return showHelp(conn, m);
});

module.exports.__game = {
  sessions, LEVELS, LEVEL_KEYS, OTHER_GAMES, ENV, PREFIX,
  create, get, start, join, startTurn, choose, confirmDone, confirmWitness,
  creditDone, creditPass, endTurn, postStats, proposeNext, stopGame, proposeOther,
  genQuestion, genSystem, rulesText, numOf, mentionsText, sendText, groupMembers, pickWitness,
};