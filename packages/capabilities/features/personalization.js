import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';
const log = createLogger('PERSONAL');

let enabled = false;
let listener = null;

export async function enablePersonalization(sock) {
  if (enabled) return;
  enabled = true;
  rawRun('CREATE TABLE IF NOT EXISTS user_prefs (jid TEXT PRIMARY KEY, language TEXT NOT NULL DEFAULT \'fr\', tone TEXT NOT NULL DEFAULT \'normal\', style TEXT NOT NULL DEFAULT \'default\', last_interaction INTEGER NOT NULL DEFAULT 0, metadata TEXT NOT NULL DEFAULT \'{}\')');
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key?.participant || msg.key?.remoteJid;
      if (!jid) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      const prefs = rawGet('SELECT * FROM user_prefs WHERE jid = ?', jid);
      const tone = detectTone(text);
      const lang = detectLang(text);
      if (prefs) {
        if (tone !== 'normal' || lang !== 'fr') {
          const meta = JSON.parse(prefs.metadata || '{}');
          meta.interactions = (meta.interactions || 0) + 1;
          rawRun('UPDATE user_prefs SET tone = ?, language = ?, last_interaction = ?, metadata = ? WHERE jid = ?',
            tone !== 'normal' ? tone : prefs.tone, lang !== 'fr' ? lang : prefs.language, Date.now(), JSON.stringify(meta), jid);
        }
      } else {
        rawRun('INSERT INTO user_prefs (jid, language, tone, last_interaction, metadata) VALUES (?, ?, ?, ?, ?)',
          jid, lang, tone, Date.now(), '{}');
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Personnalisation activ�e');
}

export function getUserPrefs(jid) {
  const prefs = rawGet('SELECT * FROM user_prefs WHERE jid = ?', jid);
  if (!prefs) return { language: 'fr', tone: 'normal', style: 'default' };
  try { prefs.metadata = JSON.parse(prefs.metadata); } catch { prefs.metadata = {}; }
  return prefs;
}

function detectTone(text) {
  if (/^(mdr|ptdr|haha|lol|xD|wesh|bg|sah|tkt)/i.test(text)) return 'informal';
  if (/^(bonjour|salut|merci|svp|s'il vous pla�t)/i.test(text)) return 'polite';
  if (/!{2,}|capitals|[A-Z]{4,}/.test(text)) return 'excited';
  return 'normal';
}

function detectLang(text) {
  if (/[����������������������]/i.test(text) && /\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|est|sont|dans|avec|pour|sur|pas|plus|bien|fait|faire|tres|trop|quoi|comment|pourquoi|quand|ou|merci|bonjour|salut|au|aux|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|vos|leur|leurs|ce|cet|cette|ces|qui|que|dont|ou|meme|entre|sous|chez|sans|vers|pendant|depuis|jusque|en|y|ca|cela|quelque|chaque|plusieurs|certain|aucun|tout|tous|toute|toutes)\b/i.test(text)) return 'fr';
  if (/\b(the|a|an|is|are|was|were|have|has|had|do|does|did|will|would|can|could|shall|should|may|might|must|this|that|these|those|i|you|he|she|it|we|they|my|your|his|her|its|our|their|me|him|us|them|in|on|at|for|with|by|from|to|of|and|or|but|not|so|if|because|about|when|where|how|what|which|why|who|whom|please|thank|hello|hi|yes|no)\b/i.test(text)) return 'en';
  if (/\b(el|la|los|las|un|una|unos|unas|y|e|o|u|pero|sino|porque|como|cuando|donde|que|quien|cual|cuales|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas|mi|tu|su|nuestro|vuestro|me|te|se|nos|os|lo|la|los|las|le|les|en|de|para|por|con|sin|sobre|entre|hasta|desde|durante|segun|mediante|hola|gracias|si|no|bien|mal|muy|mucho|poco|todo|nada|algo)\b/i.test(text)) return 'es';
  return 'fr';
}

export function disablePersonalization(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
export function isPersonalizationOn() { return enabled; }
