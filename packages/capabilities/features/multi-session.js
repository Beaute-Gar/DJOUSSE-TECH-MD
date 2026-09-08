import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
import { createLogger } from '../../infrastructure/logger.js';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';

const log = createLogger('MULTISESSION');
const sessions = new Map();

async function ensureTable() {
  rawRun(`CREATE TABLE IF NOT EXISTS wa_sessions (
    session_id TEXT PRIMARY KEY,
    creds_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL
  )`);
}

export async function addSession(sessionId, creds) {
  await ensureTable();
  rawRun('INSERT OR REPLACE INTO wa_sessions (session_id, creds_json, created_at, last_active) VALUES (?, ?, ?, ?)',
    sessionId, JSON.stringify(creds), Date.now(), Date.now());
}

export function removeSession(sessionId) {
  rawRun('DELETE FROM wa_sessions WHERE session_id = ?', sessionId);
  const sock = sessions.get(sessionId);
  if (sock) { try { sock.end(undefined); } catch {}; sessions.delete(sessionId); }
}

export function listSessions() {
  return rawAll('SELECT session_id, created_at, last_active FROM wa_sessions ORDER BY last_active DESC');
}

export function getSession(sessionId) {
  const row = rawGet('SELECT * FROM wa_sessions WHERE session_id = ?', sessionId);
  return row ? { ...row, creds_json: JSON.parse(row.creds_json) } : null;
}

export async function enableMultiSession(primarySock) {
  await ensureTable();
  log.info('Multi-session activé');

  primarySock.ev.on('messages.upsert', (m) => {
    for (const msg of m.messages || []) {
      const jid = msg.key?.remoteJid;
      if (!jid) continue;
      for (const [sid, sock] of sessions) {
        if (jid.includes(sid.replace(/[^0-9]/g, ''))) {
          rawRun('UPDATE wa_sessions SET last_active = ? WHERE session_id = ?', Date.now(), sid);
          break;
        }
      }
    }
  });
}

export async function createSessionSocket(sessionId, phone) {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(`./session_${sessionId}`);
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, log) },
    browser: Browsers.ubuntu('OS-Multi'),
    printQRInTerminal: false,
    logger: log,
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await addSession(sessionId, state.creds);
  });

  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') {
      log.info(`Session ${sessionId} connectée`);
      await addSession(sessionId, state.creds);
    }
    if (u.connection === 'close') {
      sessions.delete(sessionId);
    }
  });

  if (phone) {
    const code = await sock.requestPairingCode(phone);
    sessions.set(sessionId, sock);
    return { sock, code };
  }

  sessions.set(sessionId, sock);
  return { sock };
}
