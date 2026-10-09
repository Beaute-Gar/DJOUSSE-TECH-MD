'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const ROOT = path.resolve(__dirname, '..');
const HOST_URL = String(process.env.VIGIL_URL || config.guard.vigil.url || '').replace(/\/+$/, '');
const HOST_SECRET = process.env.VIGIL_HOST_SECRET || '';
const POLL_MS = Math.max(2000, Number(process.env.VIGIL_HOST_POLL_MS) || 5000);
const SESSION_ROOT = path.join(ROOT, 'sessions', 'managed');
const DATA_ROOT = path.join(ROOT, 'data', 'managed');
const LOG_ROOT = path.join(ROOT, 'logs', 'sessions');
const running = new Map();
const retryAt = new Map();
let stopping = false;
const CHILD_SYSTEM_ENV = new Set([
  'APPDATA',
  'COMSPEC',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'LOCALAPPDATA',
  'NODE_ENV',
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
]);

function validateConfig() {
  if (!HOST_URL || !/^https?:\/\//i.test(HOST_URL)) {
    throw new Error('Configurez VIGIL_URL dans l’environnement du gestionnaire.');
  }
  if (HOST_SECRET.length < 32) {
    throw new Error('VIGIL_HOST_SECRET doit contenir au moins 32 caractères.');
  }
}

function instanceToken(id) {
  return crypto.createHmac('sha256', HOST_SECRET).update(`vigil-session:${id}`).digest('base64url');
}

function childSystemEnv() {
  // Clés normalisées en majuscules : sur Windows la variable s'écrit
  // « Path » (casse d'origine variable) — l'OS ignore la casse, pas l'accès
  // objet du consommateur ni les tests.
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => CHILD_SYSTEM_ENV.has(key.toUpperCase()))
      .map(([key, value]) => [key.toUpperCase(), value]),
  );
}

async function getSessions() {
  const response = await fetch(`${HOST_URL}/api/host/sessions`, {
    headers: { Authorization: `Bearer ${HOST_SECRET}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Vigil répond HTTP ${response.status}.`);
  const body = await response.json();
  if (!Array.isArray(body.sessions)) throw new Error('Réponse de Vigil invalide : sessions absentes.');
  return body.sessions;
}

function startSession(session) {
  const id = String(session.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || running.has(id)) return;
  if ((retryAt.get(id) || 0) > Date.now()) return;

  fs.mkdirSync(SESSION_ROOT, { recursive: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.mkdirSync(LOG_ROOT, { recursive: true });
  const sessionDir = path.join(SESSION_ROOT, id);
  const dataDir = path.join(DATA_ROOT, id);
  const envFile = path.join(sessionDir, 'profile.env');
  fs.mkdirSync(sessionDir, { recursive: true });
  const defaultEnv = path.join(ROOT, '.env');
  const profile = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, 'utf8')
    : fs.existsSync(defaultEnv)
      ? fs.readFileSync(defaultEnv, 'utf8')
      : '';
  const safeProfile = profile
    .split(/\r?\n/)
    .filter((line) => !/^\s*(VIGIL_HOST_SECRET|VIGIL_EMAIL|VIGIL_PASSWORD)\s*=/.test(line))
    .join('\n');
  fs.writeFileSync(envFile, safeProfile, 'utf8');

  const logPath = path.join(LOG_ROOT, `${id}.log`);
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  const childEnv = {
    ...childSystemEnv(),
    ENV_FILE: envFile,
    SESSION_DIR: sessionDir,
    DATA_DIR: dataDir,
    VIGIL_URL: HOST_URL,
    VIGIL_INSTANCE_ID: id,
    VIGIL_INSTANCE_TOKEN: instanceToken(id),
    VIGIL_NODE_NAME: id,
    CONNECT_METHOD: session.connectMethod === 'pairing' ? 'pairing' : 'qr',
    PAIRING_PHONE: session.connectMethod === 'pairing' ? String(session.pairingPhone || '') : '',
  };
  delete childEnv.VIGIL_HOST_SECRET;
  delete childEnv.VIGIL_EMAIL;
  delete childEnv.VIGIL_PASSWORD;
  retryAt.delete(id);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    env: childEnv,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  running.set(id, { child, status: session.status, log, retryAt: 0 });
  console.log(`[VIGIL HOST] Session ${id} démarrée (PID ${child.pid ?? 'en attente'}).`);

  child.once('error', (error) => {
    console.error(`[VIGIL HOST] Démarrage ${id} impossible : ${error.message}`);
    const current = running.get(id);
    if (current?.child === child) {
      current.log.end();
      running.delete(id);
      retryAt.set(id, Date.now() + 15_000);
    }
  });
  child.once('exit', (code, signal) => {
    const current = running.get(id);
    if (current?.child !== child) return;
    current.log.end();
    running.delete(id);
    if (!stopping) {
      retryAt.set(id, Date.now() + 15_000);
      console.warn(`[VIGIL HOST] Session ${id} arrêtée (code=${code}, signal=${signal}).`);
    }
  });
}

function stopSession(id, entry) {
  console.log(`[VIGIL HOST] Arrêt demandé pour ${id}.`);
  running.delete(id);
  entry.log.end();
  if (entry.child.exitCode === null && !entry.child.killed) entry.child.kill('SIGTERM');
}

async function reconcile() {
  const sessions = await getSessions();
  const activeIds = new Set();
  for (const session of sessions) {
    const id = String(session.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    if (session.status === 'stopped' || session.status === 'error' || session.status === 'expired') {
      const existing = running.get(id);
      if (existing) stopSession(id, existing);
      retryAt.delete(id);
      continue;
    }
    activeIds.add(id);
    const existing = running.get(id);
    if (existing) {
      existing.status = session.status;
      continue;
    }
    startSession(session);
  }
  for (const [id, entry] of running) {
    if (!activeIds.has(id)) stopSession(id, entry);
  }
  for (const id of retryAt.keys()) {
    if (!activeIds.has(id)) retryAt.delete(id);
  }
}

async function main() {
  validateConfig();
  console.log(`[VIGIL HOST] Gestionnaire actif · ${HOST_URL} · interrogation ${POLL_MS} ms.`);
  while (!stopping) {
    try {
      await reconcile();
    } catch (error) {
      console.error(`[VIGIL HOST] Synchronisation impossible : ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const [id, entry] of running) stopSession(id, entry);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

if (require.main === module) {
  main().catch((error) => {
    console.error(`[VIGIL HOST] Fatal : ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { childSystemEnv, reconcile, startSession, stopSession };
