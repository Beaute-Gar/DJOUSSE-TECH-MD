const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;
const fs = require('fs');
const path = require('path');

const POLLS_FILE = path.join(__dirname, '..', 'data', 'polls.json');

function loadPolls() {
  try {
    fs.mkdirSync(path.dirname(POLLS_FILE), { recursive: true });
    return JSON.parse(fs.readFileSync(POLLS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function savePolls(data) {
  fs.mkdirSync(path.dirname(POLLS_FILE), { recursive: true });
  fs.writeFileSync(POLLS_FILE, JSON.stringify(data, null, 2));
}

cmd({
  pattern: 'poll',
  alias: ['sondage', 'vote'],
  desc: 'Créer un sondage',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(boxWithFooter('📊 *SONDAGES*', [
      { label: 'Usage', value: '.poll Question | Option1 | Option2 | ...' },
      { label: 'Exemple', value: '.poll Pizza ou Burger ? | Pizza | Burger | Les deux' },
      { blank: true },
      { raw: 'Min 2 options, max 10' },
    ]));
  }

  const parts = q.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Il faut au moins une question + 2 options.\nFormat: `.poll Question | Option1 | Option2`' }]));

  const question = parts[0];
  const options = parts.slice(1, 11);

  const pollMsg = `📊 *${question}*\n\n` + options.map((o, i) => `_${i + 1}._ ${o}`).join('\n') + '\n\n_Réponds avec le numéro de ton choix (1-' + options.length + ')_';

  await m.react('📊');
  await reply(pollMsg);

  const polls = loadPolls();
  polls[m.chat + '_' + Date.now()] = {
    question,
    options,
    votes: {},
    createdBy: m.sender,
    chat: m.chat,
    created: Date.now()
  };
  savePolls(polls);
});

cmd({
  pattern: /^\d$/,
  desc: 'Voter dans un sondage actif',
  category: 'tools',
  filename: __filename,
  dontAddCommandList: true,
}, async (conn, m, commands, { q, reply, sender }) => {
  const voteNum = parseInt(q);
  if (isNaN(voteNum) || voteNum < 1 || voteNum > 9) return;

  const polls = loadPolls();
  const chatPolls = Object.entries(polls).filter(([k, v]) =>
    v.chat === m.chat && (Date.now() - v.created) < 86400000
  );

  if (!chatPolls.length) return;
  const [key, poll] = chatPolls[chatPolls.length - 1];

  if (voteNum > poll.options.length) return;

  const previousVote = poll.votes[sender];
  poll.votes[sender] = voteNum - 1;
  savePolls(polls);

  const counts = new Array(poll.options.length).fill(0);
  const voters = Object.values(poll.votes);
  for (const v of voters) counts[v]++;

  const total = voters.length;
  const results = poll.options.map((o, i) => {
    const pct = total > 0 ? Math.round(counts[i] / total * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    return `${i + 1}. ${o}\n   ${bar} ${pct}% (${counts[i]})`;
  }).join('\n');

  const votedAction = previousVote !== undefined ? 'mis à jour' : 'enregistré';
  await m.react('✅');
  return reply(boxWithFooter('📊 *${poll.question}*', [
    { raw: results },
    { blank: true },
    { label: 'Total', value: `${total} vote(s)` },
    { label: 'Ton vote', value: `Option ${voteNum} (${votedAction})` },
  ]));
});

cmd({
  pattern: 'pollresult',
  alias: ['pollresults', 'resultpoll'],
  desc: 'Voir les résultats du sondage',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const polls = loadPolls();
  const chatPolls = Object.entries(polls).filter(([k, v]) =>
    v.chat === m.chat && (Date.now() - v.created) < 86400000
  );

  if (!chatPolls.length) return reply(boxWithFooter('INFO', [{ raw: '📊 Aucun sondage actif.' }]));

  const [key, poll] = chatPolls[chatPolls.length - 1];
  const counts = new Array(poll.options.length).fill(0);
  for (const v of Object.values(poll.votes)) counts[v]++;

  const total = Object.values(poll.votes).length;
  const results = poll.options.map((o, i) => {
    const pct = total > 0 ? Math.round(counts[i] / total * 100) : 0;
    return `${i + 1}. ${o} — ${counts[i]} vote(s) (${pct}%)`;
  }).join('\n');

  return reply(boxWithFooter('📊 *RÉSULTATS — ${poll.question}*', [
    { raw: results },
    { blank: true },
    { label: 'Total', value: `${total} vote(s)` },
  ]));
});
