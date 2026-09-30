'use strict';
/** Tous les messages du jeu (français, style DJOUSSE TECH). Modifier ici = modifier partout. */
const B = require('./board');
const E = require('./engine');
const cfg = require('./config');

const LINE = '━━━━━━━━━━━━━━━━━━━━';
const HEAD = `🎲 *${cfg.brand.name} • ${cfg.brand.game}*\n${LINE}`;
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

const num = (id) => String(id).split('@')[0].split(':')[0];
const tag = (id) => '@' + num(id);
const col = (c) => `${B.COLOR_INFO[c].emoji} ${B.COLOR_INFO[c].fr}`;
const bar = (progress, len = 8) => {
  const f = Math.max(0, Math.min(len, Math.round((Math.max(progress, 0) / B.HOME) * len)));
  return '▓'.repeat(f) + '░'.repeat(len - f);
};
const soloCfg = () => cfg.solo || { name: 'Robot', delayMs: 1200 };

/** Une ligne par pion : où il est, sa progression, ce qu'il lui reste. */
function pawnLine(player, i, rules) {
  const d = E.describePawn(player, i);
  if (d.kind === 'yard') {
    const need = rules.startRolls.length === 1 ? ` (il faut un ${rules.startRolls[0]})` : '';
    return `${NUM[i]} 🏠 Écurie${need}`;
  }
  if (d.kind === 'home') return `${NUM[i]} 🏁 Arrivé !`;
  if (d.kind === 'column') return `${NUM[i]} 🎯 *${d.coord}* colonne d'arrivée · étape ${d.progress}/${B.HOME} ${bar(d.progress)} · encore ${d.left}`;
  return `${NUM[i]} 📍 *${d.coord}*${d.safe ? ' ⭐' : ''} · étape ${d.progress}/${B.HOME} ${bar(d.progress)} · encore ${d.left}`;
}

const positionsBlock = (player, rules) => player.pawns.map((_, i) => pawnLine(player, i, rules)).join('\n');

/** Résumé compact de tous les joueurs (commande plateau). */
function allPositions(state) {
  return state.players.map((p) => {
    const done = p.pawns.filter((x) => x === B.HOME).length;
    const items = p.pawns.map((_, i) => {
      const d = E.describePawn(p, i);
      const where = d.kind === 'yard' ? '🏠' : d.kind === 'home' ? '🏁' : `${d.coord}(${d.progress})`;
      return `${NUM[i]}${where}`;
    }).join('  ');
    const state_ = !p.active ? ' ❌ (retiré)' : p.rank ? ` 🏆 #${p.rank}` : '';
    return `${B.COLOR_INFO[p.color].emoji} ${tag(p.id)} — ${done}/4 arrivés${state_}\n   ${items}`;
  }).join('\n');
}

function moveTarget(player, m) {
  const to = B.coordLabel(player.color, m.to);
  if (m.home) return 'l\'arrivée 🏁';
  return `${to} (étape ${m.to}/${B.HOME})`;
}

function legalLines(state) {
  const me = state.players[state.turn];
  return state.legal.map((m) => {
    let s = `• *.pion ${m.pawn + 1}* → ${moveTarget(me, m)}`;
    if (m.enter) s = `• *.pion ${m.pawn + 1}* → sortir de l'écurie en ${B.coordLabel(me.color, 0)} 🚪`;
    if (m.captured.length) {
      const c = m.captured.map((k) => `${B.COLOR_INFO[state.players[k.player].color].emoji}${NUM[k.pawn]}`).join(' ');
      s += ` ⚔️ capture ${c}`;
    }
    return s;
  }).join('\n');
}

const T = {
  HEAD, LINE, NUM, tag, col, num, positionsBlock, allPositions, pawnLine,

  help: () => `${HEAD}
Jeu de plateau pour *2 à 4 joueurs* 🎲

*Salon*
• *.ludo creer* — ouvrir un salon
• *.ludo rejoindre* — entrer dans le salon
• *.ludo start* — démarrer (organisateur)
• *.ludo solo* — jouer contre le robot (sans attendre)
• *.ludo quitter* — quitter / abandonner
• *.ludo stop* — annuler la partie (organisateur/admin)

*Pendant la partie*
• *.dé* — lancer le dé 🎲
• *.pion 1-4* — déplacer un pion
• *.ludo pos* — voir mes pions et leurs cases
• *.ludo plateau* — plateau + tous les joueurs
• *.ludo regles* — règles complètes`,

  rules: (r) => `${HEAD}
📜 *RÈGLES DU LUDO*

🎯 *But* : ramener tes 4 pions de l'écurie jusqu'à l'arrivée (56 étapes) avant les autres.

1️⃣ Il faut un *${r.startRolls.join(' ou ')}* pour sortir un pion de l'écurie.
2️⃣ Les joueurs jouent chacun leur tour, dans le sens des aiguilles d'une montre.
3️⃣ Le dé donne le nombre de cases dont avance *un* de tes pions.
${r.extraOnSix ? '4️⃣ Un *6* te fait rejouer.' : ''}${r.maxSixesInRow ? ` Mais le ${r.maxSixesInRow}e six d'affilée annule ton tour !` : ''}
5️⃣ Tomber sur un pion adverse le *capture* : il retourne à l'écurie${r.extraOnCapture ? ' et tu rejoues' : ''}.
6️⃣ Les cases ⭐ et les cases de départ sont *sûres* : pas de capture.
7️⃣ Après un tour complet, ton pion entre dans ta *colonne d'arrivée* (5 cases).
8️⃣ Pour finir, il faut le *nombre exact*${r.extraOnHome ? ' (et tu rejoues)' : ''}.
${r.blocks ? '9️⃣ Deux pions à toi sur la même case forment un *barrage* infranchissable.\n' : ''}🏆 ${r.fullRanking ? 'Le classement se poursuit jusqu\'au dernier joueur.' : 'Le premier qui ramène ses 4 pions gagne.'}

🗺️ Les cases sont repérées comme aux échecs : colonnes *A-O*, lignes *1-15*.
⏱ Tu as ${Math.round(cfg.turnTimeoutMs / 1000)} s par tour.`,

  soloStart: (state) => `${HEAD}
🤖 *MODE SOLO* — partie lancée contre le robot !

${state.players.map((p) => `${col(p.color)} — ${p.bot ? `🤖 ${soloCfg().name}` : tag(p.id)}`).join('\n')}

🎯 Il faut un *${state.rules.startRolls.join(' ou ')}* pour sortir de l'écurie.
🤖 ${soloCfg().name} lance et joue tout seul (${Math.round(soloCfg().delayMs / 1000)} s de réflexion).
▶️ *.ludo stop* pour annuler · *.ludo quitter* pour abandonner`,

  lobbyOpen: (room) => `${HEAD}
🎉 *Salon ouvert !*
👑 Organisateur : ${tag(room.hostId)}
👥 Joueurs (${room.lobby.length}/${cfg.maxPlayers}) :
${room.lobby.map((p) => `• ${tag(p.id)}`).join('\n')}

▶️ *.ludo rejoindre* pour participer
▶️ *.ludo start* pour lancer (min. ${cfg.minPlayers} joueurs)`,

  lobbyJoin: (room, who) => `✅ ${tag(who)} rejoint la partie !
👥 Joueurs (${room.lobby.length}/${cfg.maxPlayers}) : ${room.lobby.map((p) => tag(p.id)).join(', ')}
${room.lobby.length >= cfg.minPlayers ? '▶️ L\'organisateur peut lancer avec *.ludo start*' : '⏳ Il faut au moins 2 joueurs.'}`,

  gameStart: (state) => `${HEAD}
🚀 *La partie commence !* (${state.players.length} joueurs)

${state.players.map((p) => `${col(p.color)} — ${tag(p.id)}`).join('\n')}

🎯 Sortir un pion : il faut un *${state.rules.startRolls.join(' ou ')}*.
🗺️ Les cases se lisent comme aux échecs (A-O / 1-15).`,

  yourTurn: (state) => {
    const p = state.players[state.turn];
    return `🎲 Au tour de ${tag(p.id)} (${col(p.color)}) — tape *.dé*  ⏱ ${Math.round(cfg.turnTimeoutMs / 1000)} s`;
  },

  rollCaption: (state, res, auto) => {
    const p = state.players[res.player];
    let s = `${HEAD}\n🎲 ${tag(p.id)} (${col(p.color)}) a lancé un *${res.value}* !\n\n📍 *Tes pions :*\n${positionsBlock(p, state.rules)}`;
    if (res.penalty) s += `\n\n🚫 *${state.rules.maxSixesInRow} six d'affilée !* Ton tour est annulé.`;
    else if (res.legal.length === 0) s += `\n\n❌ Aucun coup possible.${res.extra ? '\n🎲 Mais c\'est un 6 : tu rejoues !' : ''}`;
    else if (auto) s += `\n\n➡️ Un seul coup possible, joué automatiquement :\n${legalLines({ ...state, turn: res.player })}`;
    else s += `\n\n➡️ *Coups possibles :*\n${legalLines({ ...state, turn: res.player })}\n\n👉 Tape *.pion <numéro>*  ⏱ ${Math.round(cfg.turnTimeoutMs / 1000)} s`;
    return s;
  },

  moveResult: (state, res) => {
    const p = state.players[res.player];
    const lines = [];
    if (res.enter) lines.push(`🚪 ${tag(p.id)} sort le pion ${NUM[res.pawn]} en *${B.coordLabel(p.color, 0)}*`);
    else if (res.home) lines.push(`🏁 ${tag(p.id)} amène le pion ${NUM[res.pawn]} à l'*arrivée* !`);
    else lines.push(`✅ ${tag(p.id)} avance ${NUM[res.pawn]} : *${B.coordLabel(p.color, res.from)}* → *${B.coordLabel(p.color, res.to)}* (étape ${res.to}/${B.HOME})`);
    res.captured.forEach((c) => {
      const q = state.players[c.player];
      lines.push(`⚔️ *Capture !* Le pion ${NUM[c.pawn]} de ${col(q.color)} ${tag(q.id)} retourne à l'écurie 😱`);
    });
    if (res.finishedPlayer) lines.push(`🏆 ${tag(p.id)} a ramené ses 4 pions : *#${p.rank}* !`);
    return lines.join('\n');
  },

  extraRoll: (state) => `🎲 ${tag(state.players[state.turn].id)} *rejoue* ! Tape *.dé*  ⏱ ${Math.round(cfg.turnTimeoutMs / 1000)} s`,

  podium: (state) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    const order = state.finished.map((i) => state.players[i]);
    state.players.forEach((p) => { if (!order.includes(p)) order.push(p); });
    return `${HEAD}\n🏆 *PARTIE TERMINÉE !*\n\n${order.map((p, i) => `${medals[i]} ${col(p.color)} ${tag(p.id)}${p.active ? '' : ' (abandon)'}`).join('\n')}\n\n👏 Bravo ${tag(state.winner.id)} !\n▶️ *.ludo creer* pour rejouer`;
  },

  timeout: (p) => `⏱ ${tag(p.id)} a laissé passer son tour.`,
  kicked: (p) => `🚪 ${tag(p.id)} est retiré de la partie (trop d'inactivité).`,
  notYourTurn: (state) => `⛔ Ce n'est pas ton tour. C'est à ${tag(state.players[state.turn].id)} (${col(state.players[state.turn].color)}).`,
  mustMove: () => '👉 Tu as déjà lancé : joue un pion avec *.pion <numéro>*.',
  mustRoll: () => '🎲 Lance d\'abord le dé avec *.dé*.',
  noGame: () => '❌ Aucune partie en cours ici. Tape *.ludo creer* pour en ouvrir une.',
  notPlayer: () => '⛔ Tu ne participes pas à cette partie.',
  alreadyRoom: () => '⚠️ Une partie ou un salon existe déjà dans ce chat. *.ludo rejoindre* ou *.ludo stop*.',
  alreadyIn: () => '😉 Tu es déjà dans la partie.',
  gameRunning: () => '⛔ La partie a déjà commencé.',
  lobbyFull: () => `⛔ Le salon est complet (${cfg.maxPlayers} joueurs).`,
  needPlayers: () => `⏳ Il faut au moins ${cfg.minPlayers} joueurs pour démarrer.`,
  hostOnly: () => '⛔ Seul l\'organisateur (ou un admin) peut faire ça.',
  stopped: () => '🛑 Partie annulée.',
  lobbyExpired: () => '⌛ Salon fermé (personne n\'a lancé la partie).',
  badPawn: (state) => `❓ Choisis un numéro valide :\n${legalLines(state)}`,
  left: (p) => `🚪 ${tag(p.id)} quitte la partie.`,
};

module.exports = T;
