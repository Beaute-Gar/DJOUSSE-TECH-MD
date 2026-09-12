const { cmd } = require('../command.cjs');
const { box, uptime } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');
const os = require('os');
const pkg = require('../package.json');

const pad = (n) => String(n).padStart(2, '0');

cmd({ pattern: 'system', alias: ['sys', 'sysinfo', 'botinfo'], desc: 'Tableau de bord système DJOUSSE TECH', category: 'system', filename: __filename }, async (conn, m, commands, { reply }) => {
  const t0 = Date.now();
  const sec = Math.floor(process.uptime());
  const cpus = os.cpus();
  const cores = cpus.length;
  const model = cores ? cpus[0].model.trim() : 'Inconnu';
  const load = os.loadavg()[0] || 0;
  const cpuPct = Math.min(100, Math.round((load * 100) / Math.max(cores, 1)));
  const total = os.totalmem() / 1024 / 1024;
  const used = total - os.freemem() / 1024 / 1024;
  const botMem = process.memoryUsage().rss / 1024 / 1024;
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  const resp = Math.max(1, Date.now() - t0);

  const text = box('🖥️ *TABLEAU DE BORD SYSTÈME — ' + String(config.BOT_NAME || 'DJOUSSE TECH').toUpperCase() + '*', [
    { blank: true },
    { label: '✦ Statut', value: '⬡ En ligne' },
    { label: '✦ Durée', value: uptime(sec) },
    { label: '✦ Vitesse de réponse', value: resp + ' ms' },
    { label: '✦ Utilisation CPU', value: cpuPct + ' %' },
    { label: '✦ Modèle processeur', value: model + ' (' + cores + ' cœurs)' },
    { label: '✦ Plateforme', value: os.platform() + ' ' + os.arch() },
    { label: '✦ RAM système', value: Math.round(used) + ' / ' + Math.round(total) + ' Mo' },
    { label: '✦ Mémoire du bot', value: Math.round(botMem) + ' Mo' },
    { label: '✦ Date & heure', value: dateStr },
    { label: '✦ Version', value: 'v' + pkg.version },
    { blank: true },
    { raw: 'Owner : ' + (config.OWNER_NUMBER ? config.OWNER_NUMBER : 'auto-détecté après connexion') },
    { raw: '⚡ DJOUSSE TECH EVOLUTION' },
  ]);
  return reply(text);
});
