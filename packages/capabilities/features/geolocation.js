import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('GEOLOC');

let enabled = false, listener = null;
const OSM_SEARCH = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=';
const OSM_REVERSE = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=';
const OSM_LINK = 'https://www.openstreetmap.org/?mlat=';
const TRIGGERS = ['où est', 'où se trouve', 'itinéraire', 'map', 'carte', 'localise', 'adresse'];

export async function enableGeolocation(sock) {
  if (enabled) return;
  enabled = true;
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      if (!text) continue;
      const lower = text.toLowerCase();
      let query = null;
      if (lower.startsWith('.geo ')) query = text.slice(5).trim();
      else for (const t of TRIGGERS) { if (lower.includes(t)) { query = text; break; } }
      if (!query) continue;
      if (query.length < 3) return sock.sendMessage(jid, { text: '❌ Requête trop courte.' });
      try {
        const res = await fetch(encodeURI(`${OSM_SEARCH}${query}`), { headers: { 'User-Agent': 'DjousseTechBot/1.0' } });
        const data = await res.json();
        if (!data?.length) return sock.sendMessage(jid, { text: `❌ Lieu "${query}" introuvable.` });
        const place = data[0];
        const lat = place.lat, lon = place.lon;
        const revRes = await fetch(`${OSM_REVERSE}${lat}&lon=${lon}`, { headers: { 'User-Agent': 'DjousseTechBot/1.0' } });
        const revData = await revRes.json();
        const address = revData?.display_name || place.display_name;
        sock.sendMessage(jid, { text: `📍 *${place.name || place.display_name}*\n\n📌 ${address}\n🌐 ${OSM_LINK}${lat}&mlon=${lon}#map=15/${lat}/${lon}\n\n📐 Type: ${place.type || 'N/A'}\n🏷️ ${place.class || ''}` });
      } catch (e) { log.warn(`Geo error: ${e.message}`); sock.sendMessage(jid, { text: '❌ Erreur recherche.' }); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Géolocalisation activée');
}

export function disableGeolocation(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isGeolocationOn() { return enabled; }
