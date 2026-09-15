const { cmd } = require('../command.cjs');
const { commands } = require('../command.cjs');
const os = require('os');
const { runtime, h2k } = require('../lib/functions.cjs');
cmd({ pattern: 'stats', desc: 'Statistiques détaillées du bot', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const totalCmds = commands.length;
const uptime = runtime(process.uptime());
const used = process.memoryUsage();
const cpu = os.cpus();
const load = os.loadavg ? os.loadavg() : [0,0,0];
const msg = `📊 Statistiques DJOUSSE TECH\n\n⏱️ Uptime: ${uptime}\n📟 Commandes: ${totalCmds}\n💾 RAM: ${(used.rss / 1024 / 1024).toFixed(2)} MB\n🖥️ CPU: ${cpu[0]?.model || 'N/A'} ${(load[0]).toFixed(2)}%\n📦 Platform: ${os.platform()}\n🏠 Hostname: ${os.hostname()}\n🧠 Node: ${process.version}`;
m.reply(msg);
});