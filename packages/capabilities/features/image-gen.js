import { createLogger } from '../../infrastructure/logger.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
import { estPremium } from './cinetpay.js';

const log = createLogger('IMGGEN');

const MOTS_INTERDITS = ['viol', 'porno', 'nu', 'sexe', 'gore', 'terrorisme', 'arme', 'drogue'];

let enabled = false;
let listener = null;

function detectPrompt(text) {
  const triggers = [/cr[ée]e?\s*(?:une|moi)?\s*image(?:\s*de)?\s*(.+)/i, /g[ée]n[ée]re?\s*(?:une)?\s*image\s*(.+)/i, /dessine\s*(?:moi)?\s*(.+)/i, /imagine\s*(.+)/i];
  for (const t of triggers) {
    const m = t.exec(text);
    if (m) return m[1].trim().replace(/[?.,!]$/, '');
  }
  return null;
}

export async function genererImage(userId, description) {
  const descriptionLower = description.toLowerCase();
  for (const mot of MOTS_INTERDITS) {
    if (descriptionLower.includes(mot)) throw new Error('Contenu refusé par le filtre de sécurité');
  }
  const isPremium = estPremium(userId);
  if (isPremium && config.OPENAI_API_KEY) {
    try {
      const result = await genererAvecDalle(description);
      return result;
    } catch (e) {
      log.warn('DALL-E échoué, fallback Pollinations: ' + e.message);
    }
  }
  return genererAvecPollinations(description);
}

async function genererAvecPollinations(description) {
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(description);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Pollinations a retourné ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, mime: 'image/png', source: 'pollinations' };
}

async function genererAvecDalle(description) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + config.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt: description, n: 1, size: '1024x1024' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DALL-E erreur ' + res.status + ': ' + err);
  }
  const data = await res.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error('Aucune URL retournée par DALL-E');
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Impossible de télécharger l\'image DALL-E');
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return { buffer: buf, mime: 'image/png', source: 'dall-e' };
}

export async function enableImageGen(sock) {
  if (enabled) return;
  enabled = true;
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;
      const prompt = detectPrompt(text);
      if (!prompt) continue;
      const sender = msg.key.participant || msg.key.remoteJid;
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: '?? Génération en cours...' }, { quoted: msg });
        const result = await genererImage(sender, prompt);
        await sock.sendMessage(msg.key.remoteJid, {
          image: result.buffer,
          caption: '?? *' + prompt + '*' + (result.source === 'dall-e' ? ' (DALL·E 3)' : ''),
          mimetype: result.mime,
        }, { quoted: msg });
      } catch (e) {
        log.warn('Erreur image: ' + e.message);
        await sock.sendMessage(msg.key.remoteJid, { text: '? ' + e.message }, { quoted: msg });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Génération d\'images activée');
}

export function disableImageGen(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}

export function isImageGenOn() { return enabled; }
