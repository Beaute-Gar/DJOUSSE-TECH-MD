const {
  publishQuoteStatus,
  selectQuote,
  formatStatus,
  validateStatusLength,
  loadCache,
  refreshCache,
  loadHistory,
  getSessionConfig,
  updateSessionConfig,
  startScheduler,
  stopScheduler,
  startCacheRefresh,
  stopCacheRefresh,
  getStatus,
  MAX_STATUS_LENGTH,
  TIME_CATEGORIES
} = require('../../utils/statusQuotes');
const config = require('../../config');

module.exports = {
  name: 'statusquote',
  aliases: ['sq'],
  category: 'owner',
  desc: 'Manage automatic WhatsApp status quotes publishing',
  ownerOnly: true,
  execute: async (sock, msg, args, ctx) => {
    const senderNumber = msg.sender.split('@')[0];
    const sessionId = senderNumber;

    if (!config.ownerNumber.includes(senderNumber)) {
      return ctx.react('❌');
    }

    const sub = (args[0] || 'status').toLowerCase();

    switch (sub) {
      case 'status': {
        try {
          const status = getStatus();
          const sessionConf = await getSessionConfig(sessionId);
          const cache = loadCache();

          const lines = [
            `╭─── *STATUS QUOTE SYSTEM* ───╮`,
            ``,
            `│ *Enabled:* ${sessionConf.enabled ? '✅ Yes' : '❌ No'}`,
            `│ *Scheduler:* ${status.schedulerActive ? '🟢 Active' : '🔴 Inactive'}`,
            `│ *Cache Refresh:* ${status.cacheRefreshActive ? '🟢 Active' : '🔴 Inactive'}`,
            ``,
            `│ *Cache Stats:*`,
            `│  Total Quotes: ${cache.total || 0}`,
            `│  Sources: ${Object.keys(cache.bySource || {}).length}`,
            ``,
            `│ *Session Config:*`,
            `│  Source: ${sessionConf.source || 'mixed'}`,
            `│  Time Category: ${sessionConf.timeCategory || 'any'}`,
            `│  Interval: ${sessionConf.intervalMinutes || 60} min`,
            ``,
            `│ *Last Published:* ${status.lastPublished ? new Date(status.lastPublished).toLocaleString() : 'Never'}`,
            ``,
            `╰──────────────────────────────╯`
          ];

          await ctx.react('📊');
          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting status: ${e.message}`);
        }
      }

      case 'on': {
        try {
          await updateSessionConfig(sessionId, { enabled: true });
          await startScheduler(sock, sessionId);
          await ctx.react('✅');
          return ctx.reply('✅ Status quotes *enabled*! Scheduler started.');
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error enabling: ${e.message}`);
        }
      }

      case 'off': {
        try {
          await updateSessionConfig(sessionId, { enabled: false });
          await stopScheduler(sessionId);
          await ctx.react('✅');
          return ctx.reply('❌ Status quotes *disabled*. Scheduler stopped.');
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error disabling: ${e.message}`);
        }
      }

      case 'now': {
        try {
          await ctx.react('⏳');
          const sessionConf = await getSessionConfig(sessionId);
          const quote = await selectQuote(sessionId, sessionConf.noRepeatDays || 7);
          const formatted = formatStatus(quote, config.botName);
          const validation = validateStatusLength(formatted);

          if (!validation.valid) {
            await ctx.react('❌');
            return ctx.reply(`Quote too long (${validation.length}/${MAX_STATUS_LENGTH} chars). Try again.`);
          }

          await publishQuoteStatus(sock, sessionId, config);
          await ctx.react('✅');
          return ctx.reply(`✅ *Published!*\n\n${formatted}`);
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error publishing: ${e.message}`);
        }
      }

      case 'next': {
        try {
          await ctx.react('🔍');
          const sessionConf = await getSessionConfig(sessionId);
          const quote = await selectQuote(sessionId, sessionConf.noRepeatDays || 7);
          const formatted = formatStatus(quote, config.botName);
          const validation = validateStatusLength(formatted);

          const lines = [
            `╭─── *NEXT QUOTE PREVIEW* ───╮`,
            ``,
            formatted,
            ``,
            `│ Length: ${validation.length}/${MAX_STATUS_LENGTH}`,
            `│ Source: ${quote.source || 'unknown'}`,
            `│ Category: ${quote.category || 'general'}`,
            `╰─────────────────────────────╯`
          ];

          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting next quote: ${e.message}`);
        }
      }

      case 'history': {
        try {
          await ctx.react('📜');
          const history = await loadHistory(sessionId);

          if (!history || history.length === 0) {
            return ctx.reply('📜 No published quotes yet.');
          }

          const last5 = history.slice(-5).reverse();
          const lines = [
            `╭─── *PUBLISHED HISTORY* ───╮`,
            ``
          ];

          last5.forEach((h, i) => {
            const date = h.publishedAt ? new Date(h.publishedAt).toLocaleDateString() : 'Unknown';
            const preview = (h.text || '').substring(0, 60);
            lines.push(`│ ${i + 1}. [${date}]`);
            lines.push(`│    ${preview}${h.text && h.text.length > 60 ? '...' : ''}`);
            lines.push(`│`);
          });

          lines.push(`│ Total: ${history.length} quotes published`);
          lines.push(`╰──────────────────────────────╯`);

          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting history: ${e.message}`);
        }
      }

      case 'cache': {
        try {
          await ctx.react('📦');
          const cache = loadCache();
          const lines = [
            `╭─── *CACHE INFO* ───╮`,
            ``,
            `│ *Total Quotes:* ${cache.total || 0}`,
            `│ *Last Refresh:* ${cache.lastRefresh ? new Date(cache.lastRefresh).toLocaleString() : 'Never'}`,
            ``,
            `│ *By Source:*`
          ];

          if (cache.bySource && typeof cache.bySource === 'object') {
            Object.entries(cache.bySource).forEach(([source, count]) => {
              lines.push(`│  • ${source}: ${count}`);
            });
          } else {
            lines.push(`│  No source data available`);
          }

          if (cache.byCategory && typeof cache.byCategory === 'object') {
            lines.push(``, `│ *By Category:*`);
            Object.entries(cache.byCategory).forEach(([cat, count]) => {
              lines.push(`│  • ${cat}: ${count}`);
            });
          }

          lines.push(`╰─────────────────────────────╯`);
          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting cache: ${e.message}`);
        }
      }

      case 'test': {
        try {
          await ctx.react('🧪');
          const sessionConf = await getSessionConfig(sessionId);
          const quote = await selectQuote(sessionId, sessionConf.noRepeatDays || 7);
          const formatted = formatStatus(quote, config.botName);
          const validation = validateStatusLength(formatted);

          const lines = [
            `╭─── *STATUS TEST* ───╮`,
            ``,
            formatted,
            ``,
            `│ *Length:* ${validation.length}/${MAX_STATUS_LENGTH}`,
            `│ *Status:* ${validation.valid ? '✅ Valid' : '❌ Too long'}`,
            `│ *Source:* ${quote.source || 'unknown'}`,
            `│ *Category:* ${quote.category || 'general'}`,
            `│ *Author:* ${quote.author || 'Unknown'}`,
            `╰────────────────────────╯`
          ];

          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error testing: ${e.message}`);
        }
      }

      case 'source': {
        try {
          await ctx.react('📌');
          const sessionConf = await getSessionConfig(sessionId);
          const lines = [
            `╭─── *CURRENT SOURCE* ───╮`,
            ``,
            `│ *Source:* ${sessionConf.source || 'mixed'}`,
            `│ *Time Category:* ${sessionConf.timeCategory || 'any'}`,
            ``,
            `│ *Available Sources:*`,
            `│  • mixed (all sources)`,
            `│  • zenquotes`,
            `│  • forismatic`,
            `│  • quotable`,
            `│  • local`,
            ``,
            `│ *Time Categories:*`
          ];

          if (TIME_CATEGORIES) {
            Object.keys(TIME_CATEGORIES).forEach(cat => {
              lines.push(`│  • ${cat}`);
            });
          }

          lines.push(`╰──────────────────────────────╯`);
          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting source: ${e.message}`);
        }
      }

      case 'config': {
        try {
          await ctx.react('⚙️');
          const sessionConf = await getSessionConfig(sessionId);
          const lines = [
            `╭─── *SESSION CONFIG* ───╮`,
            ``,
            `│ *Session ID:* ${sessionId}`,
            `│ *Enabled:* ${sessionConf.enabled ? '✅ Yes' : '❌ No'}`,
            `│ *Source:* ${sessionConf.source || 'mixed'}`,
            `│ *Time Category:* ${sessionConf.timeCategory || 'any'}`,
            `│ *Interval:* ${sessionConf.intervalMinutes || 60} minutes`,
            `│ *No Repeat Days:* ${sessionConf.noRepeatDays || 7}`,
            `│ *Last Published:* ${sessionConf.lastPublished ? new Date(sessionConf.lastPublished).toLocaleString() : 'Never'}`,
            ``,
            `│ *To change settings use:*`,
            `│  ${config.prefix}statusquote source <name>`,
            `│  ${config.prefix}statusquote interval <minutes>`,
            `╰────────────────────────────────╯`
          ];

          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error getting config: ${e.message}`);
        }
      }

      case 'refresh': {
        try {
          await ctx.react('🔄');
          await refreshCache();
          const cache = loadCache();
          await ctx.react('✅');
          return ctx.reply(`✅ Cache refreshed!\nTotal quotes now: ${cache.total || 0}`);
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error refreshing cache: ${e.message}`);
        }
      }

      case 'interval': {
        try {
          const minutes = parseInt(args[1]);
          if (isNaN(minutes) || minutes < 5) {
            return ctx.reply('❌ Interval must be at least 5 minutes.');
          }
          await updateSessionConfig(sessionId, { intervalMinutes: minutes });
          await ctx.react('✅');
          return ctx.reply(`✅ Interval set to ${minutes} minutes.`);
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error setting interval: ${e.message}`);
        }
      }

      case 'source.set': {
        try {
          const source = (args[1] || '').toLowerCase();
          const validSources = ['mixed', 'zenquotes', 'forismatic', 'quotable', 'local'];
          if (!validSources.includes(source)) {
            return ctx.reply(`❌ Invalid source. Valid: ${validSources.join(', ')}`);
          }
          await updateSessionConfig(sessionId, { source });
          await ctx.react('✅');
          return ctx.reply(`✅ Source set to *${source}*.`);
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error setting source: ${e.message}`);
        }
      }

      case 'time': {
        try {
          const category = (args[1] || '').toLowerCase();
          await updateSessionConfig(sessionId, { timeCategory: category });
          await ctx.react('✅');
          return ctx.reply(`✅ Time category set to *${category}*.`);
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error setting time category: ${e.message}`);
        }
      }

      case 'update': {
        if (!isOwner) {
          await ctx.react('❌');
          return ctx.reply('❌ Owner only.');
        }
        try {
          await ctx.reply('🔄 Lancement de la collecte de citations...');
          const { exec } = require('child_process');
          const path = require('path');
          const script = path.join(__dirname, '..', '..', 'scripts', 'collectors', 'index.cjs');
          exec(`node "${script}"`, { timeout: 60000 }, async (err, stdout) => {
            if (err) {
              await ctx.react('❌');
              return ctx.reply(`❌ Erreur collecteur: ${err.message}`);
            }
            // Refresh cache after collection
            await statusQuotes.refreshCache();
            const stats = statusQuotes.getQuoteStats();
            await ctx.react('✅');
            await ctx.reply(
              `✅ Collecte terminée !\n\n` +
              `📊 Citations totales: *${stats.cacheCount}*\n` +
              `📁 Sources locales: *${stats.localCount}*\n` +
              `💾 Dernière MAJ: ${stats.lastCacheUpdate ? new Date(stats.lastCacheUpdate).toLocaleString('fr-FR') : 'jamais'}`
            );
          });
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error running update: ${e.message}`);
        }
        return;
      }

      case 'stats': {
        try {
          const stats = statusQuotes.getQuoteStats();
          const lines = [
            `╭─── *QUOTE STATS* ───╮`,
            `│ Cache: *${stats.cacheCount}* citations`,
            `│ Locales: *${stats.localCount}* citations`,
            `│ Historique: *${stats.historyCount}* publications`,
            `│ Dernière MAJ: ${stats.lastCacheUpdate ? new Date(stats.lastCacheUpdate).toLocaleString('fr-FR') : 'jamais'}`,
            `│ Sources: ${stats.sources.join(', ') || 'aucune'}`,
            `╰──────────────────────────╯`,
          ];
          await ctx.react('📊');
          return ctx.reply(lines.join('\n'));
        } catch (e) {
          await ctx.react('❌');
          return ctx.reply(`Error: ${e.message}`);
        }
      }

      default: {
        const lines = [
          `╭─── *STATUS QUOTE HELP* ───╮`,
          ``,
          `│ *Usage:* ${config.prefix}statusquote <command>`,
          ``,
          `│ *Commands:*`,
          `│  status   - Show system status`,
          `│  on       - Enable auto quotes`,
          `│  off      - Disable auto quotes`,
          `│  now      - Publish quote now`,
          `│  next     - Preview next quote`,
          `│  history  - Show last 5 quotes`,
          `│  cache    - Show cache info`,
          `│  test     - Test status generation`,
          `│  source   - Show/set source`,
          `│  config   - Show session config`,
          `│  refresh  - Force cache refresh`,
          `│  interval - Set interval (min)`,
          `│  time     - Set time category`,
          `│  update   - Run quote collector`,
          `│  stats    - Show quote statistics`,
          ``,
          `╰──────────────────────────────────╯`
        ];

        return ctx.reply(lines.join('\n'));
      }
    }
  }
};
