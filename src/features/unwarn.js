import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { adjustTrust } from './block.js';

const log = createLogger('UNWARN');
const DB = './database/warns.json';
const GRACE_PERIOD_DAYS = 30;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '{}');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

function save(data) {
  writeFileSync(DB, JSON.stringify(data, null, 2));
}

export function enableUnwarn(sock) {
  async function cleanExpired() {
    const warns = load();
    const now = Date.now();
    let changed = false;

    for (const [jid, list] of Object.entries(warns)) {
      const fresh = list.filter(w => {
        const age = now - new Date(w.date).getTime();
        return age < GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      });
      if (fresh.length !== list.length) {
        changed = true;
        const removed = list.length - fresh.length;
        if (fresh.length === 0) {
          delete warns[jid];
          adjustTrust(jid, +20);
        } else {
          warns[jid] = fresh;
          adjustTrust(jid, +5 * removed);
        }
        log.info(`Unwarn auto: ${jid} → ${removed} avertissement(s) expiré(s)`);
      }
    }

    if (changed) save(warns);
  }

  const interval = setInterval(cleanExpired, CHECK_INTERVAL_MS);
  setTimeout(cleanExpired, 60_000);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'close') clearInterval(interval);
  });

  log.info(`Module unwarn actif (nettoyage warns > ${GRACE_PERIOD_DAYS} jours toutes les 6h)`);
}
