import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('SYSCLEAN');

let enabled = false;
let interval = null;
const TTL = 7 * 24 * 60 * 60 * 1000;

export async function runCleanup() {
  const dirs = ['./data', './session/old', './temp', './downloads'];
  let totalDeleted = 0;
  let totalSize = 0;
  const now = Date.now();
  for (const dir of dirs) {
    try {
      const entries = await fs.readdir(dir).catch(() => []);
      for (const entry of entries) {
        const full = path.join(dir, entry);
        try {
          const stat = await fs.stat(full);
          if (stat.isFile() && now - stat.mtimeMs > TTL) {
            totalSize += stat.size;
            await fs.unlink(full);
            totalDeleted++;
            log.debug('Supprimé: ' + full + ' (' + Math.round(stat.size / 1024) + 'KB)');
          }
        } catch {}
      }
    } catch {}
  }
  if (totalDeleted > 0) {
    log.info('Nettoyage: ' + totalDeleted + ' fichiers supprimés (' + Math.round(totalSize / 1024) + 'KB libérés)');
  }
  return { deleted: totalDeleted, freed: totalSize };
}

export async function enableSystemCleaner(sock) {
  if (enabled) return;
  enabled = true;
  await runCleanup();
  interval = setInterval(runCleanup, 24 * 60 * 60 * 1000);
  log.info('Nettoyage système activé (intervalle: 24h)');
}

export function disableSystemCleaner() {
  enabled = false;
  if (interval) { clearInterval(interval); interval = null; }
}
export function isSystemCleanerOn() { return enabled; }
