'use strict';

module.exports = function enregistrer(env) {
  const { P, buildFrame, bullet, cmd, config, formatDuration, fs, inData, localDb, path, toUnicode, useSqlite, waStats } = env;
cmd('diag', ['diagnostic'], {
  cat: 1, desc: 'Diagnostic connexion Baileys', usage: 'diag', owner: true, icon: '🩺',
}, async (ctx) => {
  const age = (ts) => (ts ? formatDuration(Date.now() - ts) : '—');

  /* Session : registered + poids réel du dossier (diagnostic « la clé
     est-elle encore là ? » avant de soupçonner WhatsApp) */
  let registered = false;
  let sessionSize = 0;
  let sessionFiles = 0;
  const sessDir = path.resolve(P.ROOT, config.sessionDir);
  try {
    registered = !!JSON.parse(fs.readFileSync(path.join(sessDir, 'creds.json'), 'utf8')).registered;
    for (const f of fs.readdirSync(sessDir)) {
      const st = fs.statSync(path.join(sessDir, f));
      if (st.isFile()) { sessionSize += st.size; sessionFiles++; }
    }
  } catch { /* dossier absent ou creds illisibles */ }

  /* Base locale : poids réel de data/ (état, garde, historiques, store)
     — parcours borné à 5 000 entrées : le store peut grossir */
  let dataSize = 0;
  let dataFiles = 0;
  const walkData = (dir) => {
    if (dataFiles >= 5000) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (dataFiles >= 5000) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkData(p);
      else {
        try { dataSize += fs.statSync(p).size; dataFiles++; } catch { /* fichier disparu */ }
      }
    }
  };
  walkData(inData(''));
  /* Comptes SQLite (une seule passe : counts() fait 3 requêtes) */
  const dbc = useSqlite ? localDb.counts() : null;

  const lastCut = waStats.lastDisconnectAt
    ? `${waStats.lastDisconnectCode ?? '?'} il y a ${age(waStats.lastDisconnectAt)}`
      + (waStats.lastDisconnectMsg ? ` · ${waStats.lastDisconnectMsg}` : '')
    : 'aucune depuis le démarrage';

  await ctx.reply(buildFrame('DIAGNOSTIC', [
    bullet('UPTIME PROCESS', formatDuration(process.uptime() * 1000)),
    bullet('CONNECTÉ DEPUIS', waStats.connectedSince ? age(waStats.connectedSince) : 'pas encore'),
    bullet('CONNEXIONS', String(waStats.connects)),
    bullet('DERNIÈRE COUPURE', lastCut),
    bullet('CONFLITS 440', String(waStats.conflicts)),
    bullet('HANDSHAKE 405', String(waStats.handshakeFails)),
    bullet('PAIRING', waStats.pairingAttempts
      ? `${waStats.pairingAttempts} code(s) · dernier il y a ${age(waStats.lastPairingCodeAt)}`
      : 'non utilisé'),
    bullet('VERSION WA', waStats.waVersion
      ? `${waStats.waVersion}${waStats.waVersionSource ? ` · ${waStats.waVersionSource}` : ''}`
      : 'non résolue (pas encore de cycle)'),
    bullet('MÉTHODE', (config.connectMethod || 'auto').toUpperCase()),
    bullet('SESSION', registered ? 'enregistrée' : 'à appareiller'),
    bullet('SESSION DISQUE', sessionFiles
      ? `${sessionFiles} fichiers · ${Math.round(sessionSize / 1024)} Ko`
      : 'absente'),
    bullet('BASE LOCALE', dbc
      ? `SQLite · ${dbc.events} événements · ${dbc.messages} messages · ${Math.round(dbc.bytes / 1024)} Ko`
      : (useSqlite ? 'data/bot.db' : 'JSON (node:sqlite absent)')),
    bullet('DOSSIER DATA', dataFiles
      ? `${dataFiles} fichiers · ${Math.round(dataSize / 1024)} Ko`
      : 'vide'),
    bullet('LOG BAILEYS', process.env.BAILEYS_LOG
      ? toUnicode(process.env.BAILEYS_LOG.toUpperCase())
      : 'silencieux · BAILEYS_LOG vide'),
    bullet('MÉMOIRE', `${Math.round(process.memoryUsage().heapUsed / 1048576)} Mo`),
    bullet('NODE', process.version),
  ]));
});
};
module.exports.maison = true;
