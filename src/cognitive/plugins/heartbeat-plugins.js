import { createLogger } from '../../core/logger.js';
import { bus, EVENTS } from '../event-bus.js';
import { getPendingActions } from '../automation-engine.js';
import { foresight } from '../foresight-engine.js';
import { approval } from '../governance/approval-engine.js';
import { audit } from '../governance/audit-engine.js';
import { groupStore } from '../workspace/group-cognitive-object.js';
import { workspaceManager } from '../workspace/workspace-manager.js';
import { clock } from '../cognitive-clock.js';

const log = createLogger('PLUGIN:HEARTBEAT');

export function registerHeartbeatPlugins(pipeline) {
  pipeline.on('heartbeat:minute', async (data) => {
    const pending = getPendingActions();
    const overdue = pending.filter(a => a.dueDate && clock.now() > new Date(a.dueDate).getTime());
    if (overdue.length > 0) {
      log.info(`[HEARTBEAT] ${overdue.length} overdue actions`);
      bus.emit('observer:overdue', { count: overdue.length, actions: overdue.slice(0, 5) });
    }

    const pendApprovals = approval.listPending();
    if (pendApprovals.length > 0 && pendApprovals.length !== _lastPendCount) {
      log.info(`[HEARTBEAT] ${pendApprovals.length} pending approvals`);
      _lastPendCount = pendApprovals.length;
    }
  }, { priority: 40, description: 'heartbeat-minute' });

  pipeline.on('heartbeat:five_minutes', async (data) => {
    const groups = groupStore.list();
    const inactiveThreshold = 48 * clock.MS.HOUR;

    for (const g of groups) {
      if (g.lastActive && clock.now() - g.lastActive > inactiveThreshold) {
        const ws = workspaceManager.getByJid(g.subject);
        if (ws && ws.autonomy !== 'observation') {
          bus.emit('observer:group_inactive', {
            groupJid: g.subject,
            lastActive: g.lastActive,
            daysInactive: Math.floor((clock.now() - g.lastActive) / clock.MS.DAY),
          });
        }
      }
    }
  }, { priority: 30, description: 'heartbeat-five-minutes' });

  pipeline.on('heartbeat:hour', async (data) => {
    foresight.analyzeTrends().catch(() => {});
  }, { priority: 20, description: 'heartbeat-hour' });

  pipeline.on('heartbeat:day', async (data) => {
    const now = clock.now();
    const totalGroups = groupStore.list().length;
    const totalWorkspaces = workspaceManager.list().length;
    const totalAudit = audit.summary().total || 0;
    const uptime = clock.uptime();

    log.info(`[HEARTBEAT] Daily — ${totalGroups} groups, ${totalWorkspaces} workspaces, ${totalAudit} audit entries, uptime ${Math.floor(uptime / clock.MS.HOUR)}h`);

    bus.emit('heartbeat:daily_briefing', {
      timestamp: now,
      groups: totalGroups,
      workspaces: totalWorkspaces,
      auditEntries: totalAudit,
      uptimeHours: Math.floor(uptime / clock.MS.HOUR),
    });
  }, { priority: 10, description: 'heartbeat-day' });
}

let _lastPendCount = 0;
