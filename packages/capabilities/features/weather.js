import { createLogger } from '../../infrastructure/logger.js';
import { getMeteo } from '../../infrastructure/database/weather-currency.js';
import { detectWeatherCity, formatWeatherComedy } from './smart-context.js';

const log = createLogger('WEATHER');

let enabled = false;
let listener = null;

export async function enableWeather(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const jid = msg.key.remoteJid;
      detectWeatherCity(text, jid).then(city => {
        if (!city) return;
        fetchWeather(sock, msg, city);
      });
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Météo activée (mode humour + auto-localisation)');
}

async function fetchWeather(sock, msg, city) {
  try {
    const data = await getMeteo(city);
    const reply = formatWeatherComedy(data);
    await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
  } catch (e) {
    log.warn('Erreur météo: ' + e.message);
    await sock.sendMessage(msg.key.remoteJid, { text: '? J\'arrive pas à trouver la météo pour cette ville chef. Réessaie !' }, { quoted: msg });
  }
}

export function disableWeather(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function isWeatherOn() { return enabled; }
