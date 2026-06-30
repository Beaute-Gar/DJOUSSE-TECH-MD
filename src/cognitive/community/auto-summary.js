import { createLogger } from '../../core/logger.js';
import { EVENTS, bus } from '../event-bus.js';
import { communityStore } from './community-store.js';
import { executor, ACTION_TYPES } from '../action-executor.js';
import { clock } from '../cognitive-clock.js';
import { addNode, NODE_TYPES } from '../knowledge-graph.js';

const log = createLogger('SCG:SUMMARY');

function formatHourlySummary(jid, stats, profile) {
  const today = new Date().toISOString().slice(0, 10);
  const todayMsgs = stats.dailyActivity[today] || 0;
  const hour = new Date().getHours();
  const hourMsgs = stats.hourlyActivity[String(hour)] || 0;
  const now = Date.now();
  const lastActive = communityStore.getGroupData(jid).inactivity.lastActive;
  const lastActiveAgo = clock.timeAgo(lastActive);

  const locked = communityStore.getLockedMembers(jid);
  const lockedCount = Object.keys(locked).length;

  const polls = communityStore.getPolls(jid);
  const activePolls = polls.filter(p => p.status === 'active');

  return `╔═══════════════════════════════╗
║   *Résumé Horaire* — ${new Date().toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' })}  ║
╚═══════════════════════════════╝

📊 *Activité*
Messages aujourd'hui : ${todayMsgs}
Messages cette heure : ${hourMsgs}
Dernière activité : ${lastActiveAgo}

🏷 Type : ${profile.type || 'général'}
🎭 Mode : ${communityStore.getGroupMode(jid)}

${activePolls.length > 0 ? `📋 *Sondage actif*\n${activePolls[0].question} (${Object.keys(activePolls[0].votes).length} votes)` : ''}
${lockedCount > 0 ? `🔒 ${lockedCount} membre${lockedCount > 1 ? 's' : ''} en restriction` : ''}

━━━━━━━━━━━━━━━━━━━
_Tapez ".OS stats" pour voir les statistiques détaillées_`;
}

function formatDailySummary(jid, stats, profile) {
  const today = new Date().toISOString().slice(0, 10);
  const todayMsgs = stats.dailyActivity[today] || 0;
  const totalMsgs = stats.totalMessages;
  const polls = communityStore.getAllPolls(jid);
  const closedPolls = polls.filter(p => p.status === 'closed' && p.result);

  const scores = communityStore.getGameScores(jid);
  const topPlayer = Object.entries(scores).sort((a, b) => b[1].points - a[1].points)[0];

  const locked = communityStore.getLockedMembers(jid);

  return `╔═══════════════════════════════╗
║   *Daily Briefing* — ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Douala' })}  ║
╚═══════════════════════════════╝

📊 *Activité du jour*
Messages : ${todayMsgs}
Total historique : ${totalMsgs}
Type : ${profile.type || 'général'}
Niveau : ${profile.activityLevel || 'début'}
Ambiance : ${profile.tone || 'neutre'}

${closedPolls.length > 0 ? `📋 *Sondages terminés*\n${closedPolls.slice(-3).map(p => `• ${p.question} → 🏆 ${p.result.winner || '-'} (${p.result.total} votes)`).join('\n')}` : ''}

${topPlayer ? `🏅 *Meilleur membre* : @${topPlayer[0].split('@')[0]} — ${topPlayer[1].points} pts` : ''}

${Object.keys(locked).length > 0 ? `🔒 *Membres restreints* : ${Object.keys(locked).length}` : ''}

━━━━━━━━━━━━━━━━━━━
_Tapez ".OS stats" ou ".OS classement" pour plus de détails_`;
}

export function registerAutoSummary(pipeline) {
  pipeline.on('heartbeat:hour', async (data) => {
    const { timestamp } = data;
    for (const jid of communityStore.getAllGroups()) {
      try {
        const stats = communityStore.getStats(jid);
        const profile = communityStore.getGroupProfile(jid);
        const msg = formatHourlySummary(jid, stats, profile);
        communityStore.setLastSummary(jid, { type: 'hourly', timestamp, content: msg });
        bus.emit('scg:summary:hourly', { groupJid: jid, summary: msg });
      } catch (err) {
        log.warn(`Hourly summary for ${jid}: ${err.message}`);
      }
    }
  }, { priority: 15, description: 'scg:summary:hourly' });

  pipeline.on('heartbeat:day', async (data) => {
    const { timestamp } = data;
    for (const jid of communityStore.getAllGroups()) {
      try {
        const stats = communityStore.getStats(jid);
        const profile = communityStore.getGroupProfile(jid);
        const msg = formatDailySummary(jid, stats, profile);

        addNode(`summary:${jid}:${new Date().toISOString().slice(0, 10)}`, NODE_TYPES.EVENT, {
          type: 'daily_summary', group: jid, content: msg, timestamp,
        }).catch(() => {});

        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: msg },
          source: 'scg:summary:daily',
        }).catch(() => {});

        communityStore.setLastSummary(jid, { type: 'daily', timestamp, content: msg });
        bus.emit('scg:summary:daily', { groupJid: jid, summary: msg });
      } catch (err) {
        log.warn(`Daily summary for ${jid}: ${err.message}`);
      }
    }
  }, { priority: 10, description: 'scg:summary:daily' });

  log.info('[SCG:SUMMARY] Registered');
}
