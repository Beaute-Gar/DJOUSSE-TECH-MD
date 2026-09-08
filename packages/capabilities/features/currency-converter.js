import { createLogger } from '../../infrastructure/logger.js';
import { convertirDevise } from '../../infrastructure/database/weather-currency.js';
import { detectCurrencyFromText, detectIntent, formatCurrencyComedy } from './smart-context.js';

const log = createLogger('CURRCONV');

let enabled = false;
let listener = null;

export async function enableCurrencyConverter(sock) {
  if (enabled) return;
  enabled = true;
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const intent = detectIntent(text);
      if (intent !== 'currency') continue;
      const detected = detectCurrencyFromText(text);
      if (!detected) continue;
      try {
        const result = await convertirDevise(detected.amount, detected.from, detected.to);
        const reply = formatCurrencyComedy(result, detected.from === 'USD');
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
      } catch (e) {
        log.warn('Erreur conversion: ' + e.message);
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Convertisseur de devises activé (mode NLU)');
}

export function disableCurrencyConverter(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function isCurrencyConverterOn() { return enabled; }
