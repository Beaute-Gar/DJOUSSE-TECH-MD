'use strict';

const style = require('../../config/style');

const analytics = global.groupAnalytics instanceof Map
  ? global.groupAnalytics
  : new Map();
global.groupAnalytics = analytics;

if (typeof global.trackMessage !== 'function') {
  global.trackMessage = (jid, sender) => {
    if (!jid.endsWith('@g.us')) return;
    if (!analytics.has(jid)) {
      analytics.set(jid, {
        members: {},
        hourly: new Array(24).fill(0),
        totalMessages: 0,
        since: Date.now(),
      });
    }

    const data = analytics.get(jid);
    data.totalMessages++;
    data.hourly[new Date().getHours()]++;
    if (!data.members[sender]) data.members[sender] = { count: 0, lastSeen: 0 };
    data.members[sender].count++;
    data.members[sender].lastSeen = Date.now();
  };
}

function formatDuration(ms) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function makeBar(value, max, length = 10) {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function createAnalyticsCommand(command) {
  const descriptions = {
    analytics: 'View group chat analytics',
    activity: 'View group chat activity',
    topusers: 'View the most active group members',
    peakhours: 'View group chat activity by hour',
  };

  return {
    commands: [command],
    description: descriptions[command],
    permission: 'public',
    group: true,
    private: false,
    run: async (sock, message, args, ctx) => {
      const data = analytics.get(ctx.jid);
      if (!data || data.totalMessages === 0) {
        return ctx.reply(style.renderInfo([
          'No analytics data yet.',
          '',
          'The bot tracks messages from when it was started. Keep chatting and check back later!',
        ]));
      }

      const sorted = Object.entries(data.members)
        .sort((a, b) => b[1].count - a[1].count);

      if (command === 'topusers') {
        const topUsers = sorted.slice(0, 15);
        const maxCount = topUsers[0]?.[1].count || 1;
        const lines = topUsers.map(([user, info], index) =>
          `${index + 1}. @${user.split('@')[0]} — ${info.count} msgs ${makeBar(info.count, maxCount, 8)}`
        );
        return ctx.reply(
          style.renderInfo(['Top Members', '', ...lines]),
          topUsers.map(([user]) => user)
        );
      }

      if (command === 'peakhours') {
        const maxHour = Math.max(...data.hourly);
        const lines = data.hourly.flatMap((value, hour) => value > 0
          ? [`${String(hour).padStart(2, '0')}:00 ${makeBar(value, maxHour, 12)} ${value}`]
          : []);
        return ctx.reply(style.renderInfo(['Peak Hours', '', ...lines]));
      }

      const duration = formatDuration(Date.now() - data.since);
      const memberCount = Object.keys(data.members).length;
      const topMember = sorted[0];
      const peakHour = data.hourly.indexOf(Math.max(...data.hourly));
      const avgPerMember = memberCount
        ? Math.round(data.totalMessages / memberCount)
        : 0;
      const topFive = sorted.slice(0, 5);
      const lines = topFive.map(([user, info], index) =>
        `${index + 1}. @${user.split('@')[0]} — ${info.count} msgs`
      );

      return ctx.reply(style.renderInfo([
        'Group Analytics',
        '',
        `Tracking since: ${duration} ago`,
        `Total messages: ${data.totalMessages}`,
        `Active members: ${memberCount}`,
        `Avg per member: ${avgPerMember}`,
        `Peak hour: ${String(peakHour).padStart(2, '0')}:00`,
        '',
        'Top 5 Members:',
        ...lines,
        '',
        'Use `.topusers` for full leaderboard',
        'Use `.peakhours` for hourly chart',
      ]), topFive.map(([user]) => user));
    },
  };
}

module.exports = createAnalyticsCommand;
