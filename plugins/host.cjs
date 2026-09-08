const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const os = require('os');
const process = require('process');

cmd({
  pattern: 'host',
  react: '🖥️',
  desc: 'Info système et hébergement',
  category: 'main',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  try {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const cpuCores = cpus.length;
    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
    const nodeVersion = process.version;
    const uptimeSeconds = process.uptime();
    const uptime = Math.floor(uptimeSeconds / 3600) + 'h ' + Math.floor((uptimeSeconds % 3600) / 60) + 'm ' + Math.floor(uptimeSeconds % 60) + 's';
    const now = new Date().toLocaleString();
    let deployedOn = 'Unknown';
    if (process.env.RENDER === 'true' || process.env.RENDER_INSTANCE_ID) deployedOn = 'Render';
    else if (process.env.HEROKU === 'true' || process.env.DYNO) deployedOn = 'Heroku';
    else if (process.env.REPL_ID || process.env.REPLIT_DB_URL) deployedOn = 'Replit';
    else if (process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT) deployedOn = 'Railway';
    else if (process.env.GLITCH_PROJECT_ID) deployedOn = 'Glitch';
    else if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_URL) deployedOn = 'Vercel';
    else if (hostname.includes('fly')) deployedOn = 'Fly.io';
    const text = box('🖥️ *HOST INFO*', [
      { label: 'Hébergé sur', value: deployedOn },
      { label: 'Hostname', value: hostname },
      { label: 'Platform', value: platform + ' (' + arch + ')' },
      { label: 'OS', value: truncate(release, 30) },
      { label: 'CPU', value: cpuModel + ' (' + cpuCores + ' cores)' },
      { label: 'Mémoire', value: freeMem + ' GB libre / ' + totalMem + ' GB total' },
      { label: 'Node.js', value: nodeVersion },
      { label: 'Uptime', value: uptime },
      { label: 'Heure', value: now },
    ]);
    await conn.sendMessage(from, { text }, { quoted: m });
  } catch (error) {
    reply('❌ Erreur lors de la récupération des infos host.');
  }
});
