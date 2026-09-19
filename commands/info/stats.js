const { cmd } = require('../command.cjs');
const { commands } = require('../command.cjs');
const os = require('os');
const { runtime, h2k } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'stats', desc: 'Statistiques détaillées du bot', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const totalCmds = commands.length;
const uptime = runtime(process.uptime());
const used = process.memoryUsage();
const cpu = os.cpus();
const load = os.loadavg ? os.loadavg() : [0,0,0];
m.reply(box('STATISTIQUES DJOUSSE TECH', [
  { label: 'Uptime', value: uptime },
  { label: 'Commandes', value: totalCmds },
  { label: 'RAM', value: `${(used.rss / 1024 / 1024).toFixed(2)} MB` },
  { label: 'CPU', value: `${cpu[0]?.model || 'N/A'} ${(load[0]).toFixed(2)}%` },
  { label: 'Platform', value: os.platform() },
  { label: 'Hostname', value: os.hostname() },
  { label: 'Node', value: process.version },
]));
});
