import { createLogger } from '../../core/logger.js';
import { EVENTS, bus } from '../event-bus.js';
import { communityStore } from './community-store.js';
import { executor, ACTION_TYPES } from '../action-executor.js';
import { audit } from '../governance/audit-engine.js';
import { policy, POLICY_EFFECTS } from '../governance/policy-engine.js';
import { observeInteraction } from '../digital-twin.js';
import { addNode, NODE_TYPES } from '../knowledge-graph.js';

const log = createLogger('SCG:POLL');
const LOCK_DURATION_DEFAULT = 48 * 3600000;

function formatPollMessage(poll) {
  const total = Object.keys(poll.votes).length;
  const emojis = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣', '🔟'];
  const lines = poll.options.map((opt, i) => `${emojis[i] || '▪'} ${opt}`);
  const timeLeft = poll.expiresAt ? Math.max(0, Math.floor((poll.expiresAt - Date.now()) / 60000)) : null;
  const expiry = timeLeft !== null
    ? (timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h${timeLeft % 60}m` : `${timeLeft}min`)
    : 'Pas de limite';

  return `╔═══════════════════════════════╗
║        *Sondage*              ║
╚═══════════════════════════════╝

*${poll.question}*

${lines.join('\n')}

━━━━━━━━━━━━━━━━━━━
👥 ${total} participant${total > 1 ? 's' : ''}
⏱ Fin : ${expiry}
${poll.mandatory ? '🔒 Participation obligatoire' : '💬 Participation libre'}

*Répondez avec le numéro de votre choix*`;
}

function formatResultMessage(poll) {
  if (!poll.result) return '';
  const total = poll.result.total;
  const sorted = Object.entries(poll.result.counts).sort((a, b) => b[1] - a[1]);
  const barLen = 20;

  const bars = sorted.map(([opt, count]) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const filled = Math.round((pct / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    return `${opt}\n${bar} ${count} (${pct}%)`;
  });

  return `╔═══════════════════════════════╗
║     *Résultat du sondage*     ║
╚═══════════════════════════════╝

*${poll.question}*

${bars.join('\n\n')}

━━━━━━━━━━━━━━━━━━━
👥 Total : ${total} participant${total > 1 ? 's' : ''}
🏆 Gagnant : ${poll.result.winner || 'Aucun'}`;
}

function formatLockNotification(memberJid, poll) {
  const timeLeft = poll.expiresAt ? Math.max(0, Math.floor((poll.expiresAt - Date.now()) / 60000)) : null;
  const expiry = timeLeft !== null
    ? (timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h${timeLeft % 60}m` : `${timeLeft}min`)
    : '...';

  return `@${memberJid.split('@')[0]}

⛔ *Vous devez d'abord participer au sondage en cours.*

Votre message n'a pas été pris en compte.

📊 *${poll.question}*

${poll.options.map((opt, i) => `${['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣','🔟'][i] || '▪'} ${opt}`).join('\n')}

⏱ Fin : ${expiry}

*Répondez avec le numéro de votre choix*`;
}

export async function handleCreatePoll(ctx, args, sock) {
  const text = args.join(' ');
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 3) {
    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: { jid: ctx.jid, text: 'Usage : .OS créer un sondage Question | Option1 | Option2 | ... | durée(min)' },
      source: 'scg:poll:help',
    });
    return;
  }

  const question = parts[0];
  const options = parts.slice(1, -1).filter(o => o.length > 0);
  const durationMin = parseInt(parts[parts.length - 1]) || 60;
  if (options.length < 2) {
    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: { jid: ctx.jid, text: 'Minimum 2 options requises.' },
      source: 'scg:poll:error',
    });
    return;
  }

  const poll = communityStore.createPoll(ctx.jid, {
    question,
    options,
    createdBy: ctx.senderJid,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMin * 60000,
    mandatory: false,
  });

  bus.emit('scg:poll:created', { groupJid: ctx.jid, poll, createdBy: ctx.senderJid });

  addNode(`poll:${poll.id}`, NODE_TYPES.EVENT, {
    type: 'poll', question, options, group: ctx.jid,
    createdBy: ctx.senderJid, expiresAt: poll.expiresAt,
  }).catch(() => {});

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: formatPollMessage(poll) },
    source: 'scg:poll:created',
  });
}

export async function handleVote(ctx, args, sock) {
  const text = args.join(' ').trim();
  const polls = communityStore.getPolls(ctx.jid);
  if (polls.length === 0) return;

  const poll = polls[polls.length - 1];
  const num = parseInt(text);
  if (isNaN(num) || num < 1 || num > poll.options.length) return;

  const option = poll.options[num - 1];
  const result = communityStore.votePoll(ctx.jid, poll.id, ctx.senderJid, option);

  if (result.ok) {
    observeInteraction(ctx.senderJid, 'poll_vote', poll.id);
    bus.emit('scg:poll:voted', { groupJid: ctx.jid, pollId: poll.id, voter: ctx.senderJid, option });
  }
}

export async function handleSetMandatory(ctx, args, sock) {
  const polls = communityStore.getPolls(ctx.jid);
  if (polls.length === 0) {
    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: { jid: ctx.jid, text: 'Aucun sondage actif. Créez d\'abord un sondage.' },
      source: 'scg:poll:mandatory:error',
    });
    return;
  }

  const poll = polls[polls.length - 1];
  communityStore.setMandatory(ctx.jid, poll.id, true);

  bus.emit('scg:poll:mandatory', { groupJid: ctx.jid, pollId: poll.id });

  observeInteraction(ctx.senderJid, 'poll_mandatory', poll.id);
  audit.log({
    agent: 'scg:poll', action: 'set_mandatory', resource: ctx.jid,
    details: { pollId: poll.id, question: poll.question }, result: 'enabled',
  });

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: {
      jid: ctx.jid,
      text: `🔒 *Participation obligatoire activée*

*${poll.question}*

Tous les membres doivent participer avant de continuer à discuter.

⏱ Fin : ${poll.expiresAt ? new Date(poll.expiresAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }) : '...'}

Utilisez *${['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣','🔟'].slice(0, poll.options.length).join(' ')}* pour voter.`,
    },
    source: 'scg:poll:mandatory',
  });
}

export function registerPollManager(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!isGroup || !text || text.startsWith('.') || text.toUpperCase().startsWith('.OS')) return;

    const polls = communityStore.getPolls(jid);
    if (polls.length === 0) return;

    const activePoll = polls[polls.length - 1];
    if (activePoll.status !== 'active') return;

    if (activePoll.mandatory) {
      const hasVoted = activePoll.votes[senderJid] !== undefined;
      if (!hasVoted && communityStore.isMemberLocked(jid, senderJid)) {
        const locked = communityStore.getLockedMembers(jid);
        if (locked[senderJid]) {
          communityStore.lockMember(jid, senderJid, activePoll.id,
            Math.max(0, activePoll.expiresAt - Date.now()));
        }
      }
    }
  }, { priority: 70, description: 'scg:poll:watch' });

  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!isGroup || !text) return;

    const polls = communityStore.getPolls(jid);
    if (polls.length === 0) return;

    const activePoll = polls[polls.length - 1];
    if (activePoll.status !== 'active') return;
    if (activePoll.votes[senderJid] !== undefined) return;

    if (activePoll.mandatory) {
      const trimmed = text.trim();
      const num = parseInt(trimmed);
      if (isNaN(num) || num < 1 || num > activePoll.options.length) {
        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: formatLockNotification(senderJid, activePoll) },
          source: 'scg:poll:lock:notification',
        });
        throw new Error(`SCG_POLL_LOCK: ${senderJid} blocked in ${jid}`);
      }
    }
  }, { priority: 71, description: 'scg:poll:lock' });

  pipeline.on('heartbeat:minute', async () => {
    for (const jid of communityStore.getAllGroups()) {
      const polls = communityStore.getPolls(jid);
      for (const poll of polls) {
        if (poll.status === 'active' && poll.expiresAt && Date.now() > poll.expiresAt) {
          const closed = communityStore.closePoll(jid, poll.id);
          if (closed) {
            bus.emit('scg:poll:closed', { groupJid: jid, poll: closed });
            await executor.execute({
              type: ACTION_TYPES.SEND_MESSAGE,
              payload: { jid, text: formatResultMessage(closed) },
              source: 'scg:poll:closed',
            });

            addNode(`poll_result:${poll.id}`, NODE_TYPES.EVENT, {
              type: 'poll_result', question: poll.question,
              result: closed.result, group: jid,
            }).catch(() => {});
          }
        }
      }
    }
  }, { priority: 30, description: 'scg:poll:expiry' });

  log.info('[SCG:POLL] Registered');
}
