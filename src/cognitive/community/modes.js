import { createLogger } from '../../core/logger.js';
import { EVENTS, bus } from '../event-bus.js';
import { communityStore } from './community-store.js';
import { executor, ACTION_TYPES } from '../action-executor.js';
import { audit } from '../governance/audit-engine.js';

const log = createLogger('SCG:MODES');

const MODE_DESCRIPTIONS = {
  libre: 'Conversation normale',
  silence: 'Uniquement les annonces importantes',
  formation: 'Parole distribuée par le formateur',
  debat: 'Temps limité, ordre de parole, puis vote',
  gaming: 'Organisation de jeux et tournois',
  support: 'File d\'attente, priorité, assignation',
  urgence: 'Uniquement les administrateurs',
  maintenance: 'Le bot informe et bloque temporairement',
};

const MODE_DURATIONS = {
  silence: 3600000,
  formation: 7200000,
  debat: 3600000,
  gaming: 7200000,
  urgence: 1800000,
  maintenance: 600000,
};

function formatModeMessage(mode, setBy, duration) {
  const expiry = duration ? new Date(Date.now() + duration).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }) : 'Indéfini';
  return `╔═══════════════════════════════╗
║   *Mode : ${mode.toUpperCase()}*       ║
╚═══════════════════════════════╝

📋 ${MODE_DESCRIPTIONS[mode] || 'Mode personnalisé'}

👤 Défini par : @${setBy?.split('@')[0] || 'admin'}
⏱ Jusqu'au : ${expiry}

_Tapez ".OS mode" pour voir le mode actuel._`;
}

export async function handleSetMode(ctx, args, sock) {
  const modeArg = args[0]?.toLowerCase();
  const validModes = Object.keys(MODE_DESCRIPTIONS);
  if (!modeArg || !validModes.includes(modeArg)) {
    const modes = validModes.map(m => `• *${m}* — ${MODE_DESCRIPTIONS[m]}`).join('\n');
    await executor.execute({
      type: ACTION_TYPES.SEND_MESSAGE,
      payload: {
        jid: ctx.jid,
        text: `Modes disponibles :\n\n${modes}\n\nUsage : .OS mode <nom>\nExemple : .OS mode silence`,
      },
      source: 'scg:modes:help',
    });
    return;
  }

  const duration = args[1] ? parseInt(args[1]) * 60000 : MODE_DURATIONS[modeArg] || null;
  communityStore.setGroupMode(ctx.jid, modeArg, duration ? Date.now() + duration : null, ctx.senderJid);

  bus.emit('scg:mode:changed', { groupJid: ctx.jid, mode: modeArg, setBy: ctx.senderJid, duration });

  audit.log({
    agent: 'scg:modes', action: 'set_mode', resource: ctx.jid,
    details: { mode: modeArg, duration }, result: 'applied',
  });

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: { jid: ctx.jid, text: formatModeMessage(modeArg, ctx.senderJid, duration) },
    source: 'scg:modes:set',
  });
}

export async function handleGetMode(ctx, args, sock) {
  const mode = communityStore.getGroupMode(ctx.jid);
  const g = communityStore.getGroupData(ctx.jid);
  const expiry = g.modeExpiry ? new Date(g.modeExpiry).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }) : 'Pas de limite';

  await executor.execute({
    type: ACTION_TYPES.SEND_MESSAGE,
    payload: {
      jid: ctx.jid,
      text: `📋 *Mode actuel* : ${mode.toUpperCase()}\n\n${MODE_DESCRIPTIONS[mode] || ''}\n\n⏱ Expire : ${expiry}`,
    },
    source: 'scg:modes:info',
  });
}

export function registerModes(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!isGroup || !text) return;

    const mode = communityStore.getGroupMode(jid);
    if (mode === 'libre') return;

    if (mode === 'silence') {
      if (data.episode) {
        await executor.execute({
          type: ACTION_TYPES.DELETE_MESSAGE,
          payload: { jid, key: data.episode.msgKey },
          source: 'scg:modes:silence:delete',
        }).catch(() => {});
        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: {
            jid,
            text: `🔇 @${senderJid.split('@')[0]} Mode *silence* activé. Seules les annonces sont autorisées.`,
          },
          source: 'scg:modes:silence:notification',
        }).catch(() => {});
      }
      throw new Error(`SCG_MODE_SILENCE: ${jid} in silence mode`);
    }

    if (mode === 'urgence') {
      const profile = communityStore.getGroupProfile(jid);
      const admins = [];
      if (data.episode) {
        await executor.execute({
          type: ACTION_TYPES.DELETE_MESSAGE,
          payload: { jid, key: data.episode.msgKey },
          source: 'scg:modes:urgence:delete',
        }).catch(() => {});
      }
      throw new Error(`SCG_MODE_URGENCE: ${jid} in urgence mode`);
    }

    if (mode === 'maintenance') {
      await executor.execute({
        type: ACTION_TYPES.REACT,
        payload: { jid, key: data.episode?.msgKey, emoji: '🔧' },
        source: 'scg:modes:maintenance:react',
      }).catch(() => {});
    }
  }, { priority: 90, description: 'scg:modes:enforce' });

  pipeline.on('heartbeat:minute', async () => {
    for (const jid of communityStore.getAllGroups()) {
      const oldMode = communityStore.getGroupMode(jid);
      const g = communityStore.getGroupData(jid);
      if (g.modeExpiry && Date.now() > g.modeExpiry && oldMode !== 'libre') {
        communityStore.setGroupMode(jid, 'libre', null, null);
        bus.emit('scg:mode:changed', { groupJid: jid, mode: 'libre', reason: 'expired' });
        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: `✅ Mode *${oldMode}* terminé. Retour au mode *libre*.` },
          source: 'scg:modes:expired',
        }).catch(() => {});
      }
    }
  }, { priority: 25, description: 'scg:modes:expiry' });

  log.info('[SCG:MODES] Registered');
}
