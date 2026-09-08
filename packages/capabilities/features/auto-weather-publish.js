import { createLogger } from '../../infrastructure/logger.js';
import { getAutoLocation, generateMorningWeather } from './smart-context.js';
import { getMeteo } from '../../infrastructure/database/weather-currency.js';

const log = createLogger('WEATHERPUB');

let enabled = false;
let interval = null;
const PUBLISH_HOUR = 8;
const PUBLISH_MINUTE = 0;

async function getActiveGroups(sock) {
  try {
    const { cm } = await import('../core/handler.js');
    const groups = cm.getActivatedGroups ? cm.getActivatedGroups() : {};
    return Object.entries(groups).filter(([, g]) => g?.active !== false).map(([jid]) => jid);
  } catch { return []; }
}

async function publishMorningWeather(sock) {
  const groups = await getActiveGroups(sock);
  if (groups.length === 0) {
    log.info('Aucun groupe actif pour la météo matinale');
    return;
  }
  log.info(`Publication météo matinale dans ${groups.length} groupe(s)`);
  for (const jid of groups) {
    try {
      const location = await getAutoLocation(jid);
      const city = location.ville;
      const weather = await getMeteo(city);
      const message = await generateMorningWeather(weather.ville || city, location.pays, location.fuseau, weather);
      await sock.sendMessage(jid, { text: message });
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      log.warn(`Météo matinale [${jid}]: ${e.message}`);
    }
  }
}

function scheduleNext(sock) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(PUBLISH_HOUR, PUBLISH_MINUTE, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  log.info(`Prochaine météo matinale: ${next.toLocaleString('fr-FR')} (dans ${Math.round(delay / 60000)} min)`);
  setTimeout(() => {
    publishMorningWeather(sock).catch(e => log.warn(`Publish error: ${e.message}`));
    scheduleNext(sock);
  }, delay);
}

export async function enableAutoWeatherPublish(sock) {
  if (enabled) return;
  enabled = true;
  scheduleNext(sock);
  log.info('Publication météo matinale activée (8h00)');
}

export function disableAutoWeatherPublish() {
  enabled = false;
  if (interval) clearTimeout(interval);
}

export function isAutoWeatherPublishOn() { return enabled; }
