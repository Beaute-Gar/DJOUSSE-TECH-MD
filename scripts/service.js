'use strict';
/**
 * scripts/service.js — gestionnaire des deux process du système
 *
 *   node scripts/service.js [cible] <start|stop|status|watch>
 *
 *   cible = bot (défaut)  → node index.js
 *   cible = vigil         → next start -p 3120  (le « deuxième avis »
 *                            du pont guard/src/vigil.js)
 *
 * Exemples :
 *   node scripts/service.js start            lance le bot
 *   node scripts/service.js watch            + surveillance (relance auto)
 *   node scripts/service.js vigil start      lance Vigil
 *   node scripts/service.js status           état des deux
 *
 * Sortie → logs/<cible>.log (append, heure locale) · PID → logs/<cible>.pid
 * Watchdog  → logs/<cible>.watch.pid
 *
 * Le process est créé avec `detached` + `unref` : il survit à la
 * fermeture du terminal, sans pm2 ni daemon externe.
 *
 * ── watchdog (`watch`) ─────────────────────────────────────────────
 * Une boucle détachée vérifie toutes les 10 s que la cible est en vie ;
 * process mort → relance immédiate (les sessions WhatsApp se rechargent
 * seules depuis `session/`). « stop » tue d'abord le watchdog, sinon il
 * relancerait ce que l'on vient d'arrêter.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');

const APPS = {
  bot: {
    run: [process.execPath, ['index.js']],
    cwd: ROOT,
  },
  vigil: {
    run: [process.execPath, [path.join(ROOT, '..', 'vigil', 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start', '-p', '3120']],
    cwd: path.join(ROOT, '..', 'vigil'),
  },
};

const files = (name) => ({
  log: path.join(LOG_DIR, `${name}.log`),
  pid: path.join(LOG_DIR, `${name}.pid`),
  watch: path.join(LOG_DIR, `${name}.watch.pid`),
});

/* Heure LOCALE, la même que celle affichée par .journal / .chatlog */
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Chemin de fichier .pid (string) — ex. f.pid ou f.watch. */
function readPid(file) {
  try {
    const pid = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch { return null; }
}

/** process.kill(pid, 0) ne fait rien mais signale l'existence. */
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function tail(f, n = 25) {
  try { return fs.readFileSync(f.log, 'utf8').split(/\r?\n/).filter(Boolean).slice(-n); }
  catch { return ['(aucun log)']; }
}

function start(name) {
  const app = APPS[name];
  const f = files(name);
  const old = readPid(f.pid);
  if (alive(old)) {
    console.log(`[${name}] Déjà en cours (PID ${old}) — « ${name} stop » d'abord.`);
    return 1;
  }
  if (name === 'vigil' && !fs.existsSync(path.dirname(app.run[1][0]))) {
    console.log('[vigil] introuvable : vigil/node_modules absent (npm install dans Documents/vigil).');
    return 1;
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(f.log, `\n──── ${stamp()} ──── démarrage ────\n`);

  const out = fs.openSync(f.log, 'a');
  const child = spawn(app.run[0], app.run[1], {
    cwd: app.cwd,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.unref();
  fs.writeFileSync(f.pid, String(child.pid), 'utf8');

  console.log(`[${name}] Lancé — PID ${child.pid}`);
  console.log(`[${name}] Log   : ${f.log}`);
  console.log(`[${name}] Suivi : Get-Content logs\\${name}.log -Tail 20 -Wait`);
  console.log(`[${name}] Arrêt : node scripts/service.js ${name} stop`);
  return 0;
}

function stop(name) {
  const f = files(name);
  const killedWatch = stopWatch(name);
  if (killedWatch) console.log(`[${name}] Watchdog arrêté.`);
  const pid = readPid(f.pid);
  if (!alive(pid)) {
    console.log(`[${name}] Aucun process en cours.`);
    try { fs.unlinkSync(f.pid); } catch { /* déjà absent */ }
    return 0;
  }
  // /T : toute l'arborescence (le bot lance yt-dlp en enfant)
  const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  const ok = r.status === 0 || /n'existe pas|no running instance/i.test(String(r.stderr || r.stdout || ''));
  fs.appendFileSync(f.log, `\n──── ${stamp()} ──── arrêt (PID ${pid}) ────\n`);
  console.log(ok ? `[${name}] Arrêté (PID ${pid}).` : `[${name}] taskkill : ${r.stdout || r.stderr}`);
  try { fs.unlinkSync(f.pid); } catch { /* rien */ }
  return ok ? 0 : 1;
}

function status(name) {
  const f = files(name);
  const pid = readPid(f.pid);
  if (alive(pid)) {
    console.log(`[${name}] EN COURS — PID ${pid}`);
  } else {
    console.log(`[${name}] ARRÊTÉ` + (pid ? ` (PID ${pid} mort)` : ''));
    try { fs.unlinkSync(f.pid); } catch { /* rien */ }
  }
  const w = readPid(f.watch);
  console.log(alive(w)
    ? `[${name}] Watchdog actif (PID ${w}) — relance sous 10 s en cas de mort`
    : `[${name}] Watchdog inactif (« ${name} watch » pour l'activer)`);
  console.log('--- dernière sortie ---');
  for (const l of tail(f, alive(pid) ? 25 : 12)) console.log(l);
  return alive(pid) ? 0 : 3;
}

/**
 * Démarre le watchdog (boucle détachée) pour une cible.
 * Idempotent : un seul watchdog par cible.
 */
function watch(name) {
  const f = files(name);
  if (alive(readPid(f.watch))) {
    console.log(`[${name}] Watchdog déjà actif.`);
    return 0;
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const wlog = path.join(LOG_DIR, `${name}.watch.log`);
  const out = fs.openSync(wlog, 'a');
  fs.appendFileSync(wlog, `\n──── ${stamp()} ──── watchdog actif ────\n`);
  const child = spawn(process.execPath, [__filename, name, 'watch-loop'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.unref();
  fs.writeFileSync(f.watch, String(child.pid), 'utf8');
  console.log(`[${name}] Watchdog lancé (PID ${child.pid}) — vérifie la cible toutes les 10 s`);
  console.log(`[${name}] Arrêt du couple : node scripts/service.js ${name} stop`);
  return 0;
}

/**
 * Boucle du watchdog (exécutée dans le process détaché de `watch`).
 * Retourne undefined pour que le process reste ouvert.
 */
function watchLoop(name) {
  const f = files(name);
  fs.writeFileSync(f.watch, String(process.pid), 'utf8');
  setInterval(() => {
    if (alive(readPid(f.pid))) return;             // la cible vit : rien à faire
    fs.appendFileSync(f.log,
      `\n──── ${stamp()} ──── watchdog : process mort, relance ────\n`);
    start(name);
  }, 10_000);
}

/**
 * Arrêt : on tue d'abord le watchdog (sinon il relancerait la cible),
 * puis la cible elle-même.
 */
function stopWatch(name) {
  const f = files(name);
  const w = readPid(f.watch);
  if (!alive(w)) { try { fs.unlinkSync(f.watch); } catch { /* rien */ } return false; }
  spawnSync('taskkill', ['/PID', String(w), '/T', '/F'], { windowsHide: true });
  try { fs.unlinkSync(f.watch); } catch { /* rien */ }
  return true;
}

const CMDS = { start, stop, status, watch, 'watch-loop': watchLoop };
const USAGE = 'start|stop|status|watch';

/* argv : [script] [cible?] [commande?] — un seul mot = commande sur « bot » */
const argv = process.argv.slice(2);
let name = 'bot';
let cmd = 'status';
if (argv.length === 1) { (CMDS[argv[0]] ? (cmd = argv[0]) : (name = argv[0])); }
else if (argv.length >= 2) { name = argv[0]; cmd = argv[1]; }

if (!APPS[name]) {
  console.error(`Cible inconnue « ${name} » — attendu : ${Object.keys(APPS).join(' | ')}`);
  process.exit(64);
}
if (!CMDS[cmd]) {
  console.error(`Usage : node scripts/service.js [${Object.keys(APPS).join('|')}] ${USAGE}`);
  process.exit(64);
}
const result = CMDS[cmd](name);
if (result !== undefined) process.exit(result); // watch-loop : reste ouvert
