const { cmd } = require('../command.cjs');
const { chatSystem } = require('../lib/ai.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION OU VÉRITÉ — jeu de groupe (ou tête-à-tête en privé)
   Aucune question n'est codée en dur : chaque défi est généré par IA à la
   volée, au niveau de difficulté EXTREME, différent pour chaque joueur.

   Mécanique :
   1. .avt lance la partie : annonce dans le groupe (mention @tous), fenêtre
      d'inscription de 60s pendant laquelle on tape .jouer pour s'inscrire.
   2. Au début de chaque manche, le bot poste UNE annonce collective en
      mentionnant tout le monde : chacun répond "action" ou "vérité".
   3. Dès qu'un membre répond, le bot lui génère un défi personnalisé (IA,
      EXTREME) et le tag dans le groupe. Un membre NON inscrit peut aussi
      répondre et recevoir un défi — mais on lui rappelle qu'il doit
      s'inscrire pour que ça compte dans le classement du prochain tour.
   4. Le joueur "termine" son défi en répondant à son message de défi
      (système déclaratif — le bot ne peut pas vérifier une action réelle
      dans le monde physique, c'est annoncé clairement dans les règles).
   5. Après 5 minutes, la manche se clôture : statistiques, meilleur joueur,
      proposition de relancer une manche.
   ═══════════════════════════════════════════════════════════════════════════ */

const REGISTRATION_MS = parseInt(process.env.AVT_REGISTRATION_MS || '60000', 10);
const ROUND_MS = parseInt(process.env.AVT_ROUND_MS || String(5 * 60 * 1000), 10);
const DIFFICULTY = 'EXTREME'; // seul palier proposé, par choix du owner

/* État de jeu par discussion (Map en mémoire — perdu au redémarrage du bot,
   c'est un jeu, pas une donnée à conserver). */
const games = new Map(); // chat -> gameState

function newGame(chat, startedBy) {
  return {
    chat,
    phase: 'registration', // 'registration' | 'round' | 'ended'
    registered: new Set(),
    scores: new Map(), // jid -> points
    completed: new Map(), // jid -> nb défis réussis (toutes manches confondues)
    awaitingChoice: new Set(), // qui a été sollicité ce tour et n'a pas encore choisi
    pendingChallenge: new Map(), // jid -> { type, text, sentAt }
    roundNumber: 0,
    startedBy,
    registrationTimer: null,
    roundTimer: null,
  };
}

async function genererDefi(type, difficulte) {
  const sys = type === 'action'
    ? `Tu es le maître du jeu "Action ou Vérité" niveau ${difficulte}. Génère UNE SEULE action audacieuse et originale à réaliser, adaptée à un groupe d'amis sur WhatsApp (rien d'illégal, rien de dangereux physiquement, rien qui implique de tiers non consentants). Réponds uniquement avec l'action, une phrase, sans préambule ni numérotation.`
    : `Tu es le maître du jeu "Action ou Vérité" niveau ${difficulte}. Génère UNE SEULE question audacieuse et originale, adaptée à un groupe d'amis sur WhatsApp (rien d'illégal, respecte la dignité des joueurs). Réponds uniquement avec la question, une phrase, sans préambule ni numérotation.`;
  try {
    const out = await chatSystem(sys, `Génère un défi ${type} niveau ${difficulte}, différent des précédents.`);
    return truncate(String(out || '').trim().replace(/^["'«»]|["'«»]$/g, ''), 300) || null;
  } catch (e) {
    return null;
  }
}

function mention(jid) {
  return '@' + String(jid).split('@')[0];
}

async function sendRoundAnnouncement(sock, game) {
  game.roundNumber++;
  game.awaitingChoice = new Set(game.registered);
  const registeredList = [...game.registered];
  const mentions = registeredList.length ? registeredList : undefined;
  const text = box(`🎲 *ACTION OU VÉRITÉ — Manche ${game.roundNumber}*`, [
    { raw: registeredList.length ? registeredList.map(mention).join(' ') : '_Aucun joueur inscrit — tout le monde peut quand même répondre !_' },
    { blank: true },
    { raw: '👉 Réponds simplement *action* ou *vérité* dans ce groupe pour recevoir ton défi personnalisé.' },
    { raw: `⏱️ Cette manche dure ${ROUND_MS / 60000} minutes.` },
    { raw: '⚠️ Système déclaratif : le bot ne peut pas vérifier une action réelle — réponds à ton défi pour le valider, en toute bonne foi.' },
  ]);
  await sock.sendMessage(game.chat, { text, mentions });

  clearTimeout(game.roundTimer);
  game.roundTimer = setTimeout(() => closeRound(sock, game), ROUND_MS);
}

async function closeRound(sock, game) {
  game.phase = 'ended';
  const entries = [...game.scores.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [];
  if (!entries.length) {
    lines.push({ raw: "Personne n'a validé de défi ce tour-ci — dommage ! 😅" });
  } else {
    entries.slice(0, 5).forEach(([jid, score], i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || '▫️';
      lines.push({ raw: `${medal} ${mention(jid)} — ${score} défi(s) validé(s)` });
    });
  }
  lines.push({ blank: true });
  lines.push({ raw: '🔁 Tape *.avt* pour relancer une manche, ou *.jouer* pour rejoindre si tu n\'es pas encore inscrit.' });

  await sock.sendMessage(game.chat, {
    text: box('🏆 *FIN DE LA MANCHE — CLASSEMENT*', lines),
    mentions: entries.map(([jid]) => jid),
  }).catch(() => {});

  games.delete(game.chat);
}

cmd({
  pattern: 'avt',
  alias: ['actionverite', 'action-verite', 'avt-lancer'],
  react: '🎲',
  desc: 'Lancer une partie Action ou Vérité (questions générées par IA, niveau extreme)',
  category: 'game',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const chat = m.chat;
  if (games.has(chat)) {
    return reply('⚠️ Une partie est déjà en cours dans cette discussion. Attends la fin de la manche ou tape *.jouer* pour t\'inscrire.');
  }

  const game = newGame(chat, m.sender);
  games.set(chat, game);

  if (m.isGroup) {
    let participants = [];
    try {
      const meta = await conn.groupMetadata(chat);
      participants = (meta.participants || []).map(p => p.id);
    } catch (e) { /* pas grave, on continue sans la liste complète */ }

    await conn.sendMessage(chat, {
      text: box('🎲 *ACTION OU VÉRITÉ — NOUVELLE PARTIE*', [
        { raw: `Lancée par ${mention(m.sender)} — niveau *${DIFFICULTY}* 🔥` },
        { blank: true },
        { raw: '👉 Tape *.jouer* dans les 60 secondes pour t\'inscrire et apparaître au classement.' },
        { raw: '_Tu peux quand même répondre aux défis sans être inscrit, mais tes points ne compteront qu\'à partir de ton inscription._' },
        { blank: true },
        { raw: participants.length ? participants.map(mention).join(' ') : '' },
      ]),
      mentions: participants,
    });

    game.registrationTimer = setTimeout(async () => {
      if (game.phase !== 'registration') return;
      game.phase = 'round';
      if (game.registered.size === 0) {
        await conn.sendMessage(chat, { text: '😴 Personne ne s\'est inscrit — la manche démarre quand même, réponds *action* ou *vérité* pour jouer !' }).catch(() => {});
      }
      await sendRoundAnnouncement(conn, game);
    }, REGISTRATION_MS);
  } else {
    /* Discussion privée : pas de phase d'inscription, l'unique interlocuteur
       est auto-inscrit et la manche démarre tout de suite. */
    game.registered.add(m.sender);
    game.phase = 'round';
    await sendRoundAnnouncement(conn, game);
  }
});

cmd({
  pattern: 'jouer',
  alias: ['rejoindre', 'register-avt'],
  react: '✋',
  desc: 'S\'inscrire à la partie Action ou Vérité en cours',
  category: 'game',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const game = games.get(m.chat);
  if (!game) return reply('❌ Aucune partie en cours ici. Lance-en une avec *.avt*.');
  if (game.registered.has(m.sender)) return reply('✅ Tu es déjà inscrit.');
  game.registered.add(m.sender);
  reply(`✅ ${mention(m.sender)} est inscrit ! ${game.phase === 'registration' ? 'La manche démarre bientôt.' : 'Tu comptes à partir du prochain tour.'}`);
});

/* ═══ Interception des réponses libres (pas de préfixe) ═══
   Appelée depuis index.cjs pour CHAQUE message sans préfixe, dans les
   discussions où une partie est active. Retourne true si le message a été
   consommé par le jeu (pour que index.cjs ne le traite pas comme du bruit). */
async function handleRawReply(sock, m) {
  const game = games.get(m.chat);
  if (!game || game.phase !== 'round' || !m.body) return false;
  const text = m.body.trim().toLowerCase();
  const sender = m.sender;

  /* Cas 1 : le joueur vient de choisir "action" ou "vérité" */
  if ((text === 'action' || text === 'vérité' || text === 'verite') && !game.pendingChallenge.has(sender)) {
    const type = text === 'action' ? 'action' : 'verite';
    const notRegistered = !game.registered.has(sender);
    const defi = await genererDefi(type, DIFFICULTY);
    if (!defi) {
      await m.reply('❌ Impossible de générer un défi pour le moment (IA indisponible) — réessaie dans un instant.').catch(() => {});
      return true;
    }
    game.pendingChallenge.set(sender, { type, text: defi, sentAt: Date.now() });
    await sock.sendMessage(m.chat, {
      text: box(type === 'action' ? '🔥 *ACTION*' : '💭 *VÉRITÉ*', [
        { raw: mention(sender) },
        { blank: true },
        { raw: defi },
        { blank: true },
        { raw: notRegistered ? '⚠️ Tu n\'es pas inscrit — tape *.jouer* pour que ça compte au classement du prochain tour.' : '_Réponds à ce message une fois ton défi réalisé pour valider ton point._' },
      ]),
      mentions: [sender],
    });
    return true;
  }

  /* Cas 2 : le joueur répond pour valider un défi déjà reçu */
  if (game.pendingChallenge.has(sender)) {
    game.pendingChallenge.delete(sender);
    if (game.registered.has(sender)) {
      game.scores.set(sender, (game.scores.get(sender) || 0) + 1);
      game.completed.set(sender, (game.completed.get(sender) || 0) + 1);
      await m.reply(`✅ Défi validé pour ${mention(sender)} ! Score : ${game.scores.get(sender)} point(s).`).catch(() => {});
    } else {
      await m.reply(`✅ Défi noté, mais ${mention(sender)} n'est pas inscrit — tape *.jouer* pour que tes prochains points comptent.`).catch(() => {});
    }
    return true;
  }

  return false;
}

module.exports = { handleRawReply };
