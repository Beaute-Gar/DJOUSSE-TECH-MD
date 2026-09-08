import { createLogger } from '../../infrastructure/logger.js';
import { analyzeGroupMood, getConvContext, getPersonaPrompt, detectFlirtTarget } from './smart-context.js';

const log = createLogger('DYNPERSONA');

let enabled = false;
let listener = null;
let analysisInterval = null;

const groupMessages = new Map();
const GROUP_ANALYSIS_INTERVAL = 240000;

const PERSONA_MAP = {
  'fun': 'humoriste',
  'blague': 'humoriste',
  'détente': 'humoriste',
  'flirt': 'flirt',
  'drag': 'flirt',
  'drague': 'flirt',
  'romantique': 'flirt',
  'sexe': 'flirt',
  'sérieux': 'sage',
  'tension': 'sage',
  'conseil': 'sage',
  'technique': 'business',
  'pro': 'business',
  'business': 'business',
  'étude': 'professeur',
  'apprentissage': 'professeur',
  'motiv': 'motivateur',
  'encourag': 'motivateur',
  'détective': 'detective',
  'curieux': 'detective',
  'général': 'ami',
  'normal': 'ami',
};

export async function enableDynamicPersona(sock) {
  if (enabled) return;
  enabled = true;

  listener = async (m) => {
    try {
      if (!enabled) return;
      for (const msg of m.messages || []) {
        if (msg.key?.fromMe) continue;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
        if (!text) continue;
        const jid = msg.key.remoteJid;
        if (!jid?.endsWith('@g.us')) continue;
        const sender = msg.pushName || msg.key.participant || 'inconnu';
        if (!groupMessages.has(jid)) groupMessages.set(jid, []);
        const msgs = groupMessages.get(jid);
        msgs.push(`${sender}: ${text}`);
        if (msgs.length > 60) msgs.splice(0, msgs.length - 60);
        const ctx = getConvContext(jid);
        const target = await detectFlirtTarget(text, sender);
        if (target && typeof target === 'string' && target !== 'moi' && !target.match(/^@/)) {
          ctx.flirtTarget = target;
          ctx.flirtActive = true;
          ctx.persona = 'seduisant';
          log.info(`Flirt target set: ${target} in ${jid}`);
        }
        if (/(?:laisse|arr[êe]te|stop|calme\s+toi)\s+(?:de\s+)?(?:draguer|flirter|parler)/i.test(text)) {
          ctx.flirtActive = false;
          ctx.flirtTarget = null;
          ctx.persona = 'normal';
          log.info(`Flirt désactivé dans ${jid}`);
        }
      }
    } catch (e) {
      log.warn(`Listener: ${e.message}`);
    }
  };
  sock.ev.on('messages.upsert', listener);

  analysisInterval = setInterval(async () => {
    for (const [jid, msgs] of groupMessages) {
      if (msgs.length < 5) continue;
      try {
        const mood = await analyzeGroupMood(jid, msgs);
        const ctx = getConvContext(jid);
        if (ctx.flirtActive && ctx.flirtTarget) {
          ctx.persona = 'seduisant';
        } else {
          for (const [keyword, persona] of Object.entries(PERSONA_MAP)) {
            if (mood.ambiance.includes(keyword)) {
              ctx.persona = persona;
              break;
            }
          }
        }
        ctx.lastMood = mood;
        if (ctx.persona !== 'normal') {
          log.info(`Persona: ${ctx.persona} (${mood.ambiance}) [${jid}]`);
        }
      } catch (e) { log.warn(`Analyse: ${e.message}`); }
    }
  }, GROUP_ANALYSIS_INTERVAL);

  log.info('Persona dynamique activée');
}

export function getCurrentPersona(jid) {
  if (!jid) return 'normal';
  const ctx = getConvContext(jid);
  if (ctx.flirtActive && ctx.flirtTarget) return 'seduisant';
  return ctx.persona || 'normal';
}

export function getFlirtTarget(jid) {
  const ctx = getConvContext(jid);
  return ctx.flirtActive ? ctx.flirtTarget : null;
}

export function setPersona(jid, persona) {
  const ctx = getConvContext(jid);
  ctx.persona = persona;
}

export function getLastMood(jid) {
  const ctx = getConvContext(jid);
  return ctx.lastMood || null;
}

export function isFlirtActive(jid) {
  const ctx = getConvContext(jid);
  return ctx.flirtActive && ctx.flirtTarget;
}

export function disableDynamicPersona(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
  if (analysisInterval) clearInterval(analysisInterval);
}

export function isDynamicPersonaOn() { return enabled; }
