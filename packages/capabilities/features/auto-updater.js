import { createLogger } from '../../infrastructure/logger.js';
import { createRequire } from 'module';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const pkg = require('../../../package.json');
const config = require('../../../config.cjs');
const log = createLogger('AUTOUPD');

let enabled = false;
let ownerJid = null;
let notified = false;

/* Anti-spam « en ligne » : au plus 1 notification toutes les 6h, persisté
   (process redémarré souvent → ne doit plus être reçu à chaque cycle). */
const NOTIFY_STATE_FILE = path.join(process.cwd(), 'database', 'notify_state.json');
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function lastOnlineNotify() {
  try {
    if (existsSync(NOTIFY_STATE_FILE)) return Number(JSON.parse(readFileSync(NOTIFY_STATE_FILE, 'utf8')).onlineAt) || 0;
  } catch {}
  return 0;
}

function shouldNotifyOnline() {
  return Date.now() - lastOnlineNotify() >= NOTIFY_COOLDOWN_MS;
}

export async function enableAutoUpdater(sock, owner) {
  if (enabled) return;
  enabled = true;
  ownerJid = owner || (config.OWNER_NUMBER ? config.OWNER_NUMBER + '@s.whatsapp.net' : null);
  if (!ownerJid) { log.warn('OWNER_NUMBER non défini'); return; }
  const version = pkg.version;
  log.info('Version actuelle: ' + version);
  try {
    const res = await fetch('https://registry.npmjs.org/cognitive-os/latest', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const latest = (await res.json()).version;
      if (latest !== version) {
        const msg = '🔄 *Mise à jour disponible*\n\nActuelle: ' + version + '\nDernière: ' + latest + '\n\nExécute git pull puis npm install';
        await sock.sendMessage(ownerJid, { text: msg });
        notified = true;
      }
    }
  } catch {}
  const online = '✅ *' + config.BOT_NAME + '* v' + version + ' en ligne ✅\nCommandes: ' + config.PREFIX + 'menu';
  if (shouldNotifyOnline()) {
    try {
      await sock.sendMessage(ownerJid, { text: online });
      try { writeFileSync(NOTIFY_STATE_FILE, JSON.stringify({ onlineAt: Date.now() }), 'utf8'); } catch {}
      log.info('Notification version envoyée (cooldown 6h)');
    } catch (e) { log.warn('Envoi notification: ' + e.message); }
  } else {
    log.info('Notification « en ligne » ignorée: cooldown 6h actif');
  }
}

export function isAutoUpdaterOn() { return enabled; }
export function getVersion() { return pkg.version; }
export function wasUpdateNotified() { return notified; }
