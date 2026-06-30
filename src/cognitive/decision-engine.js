import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { getContext } from './context-engine.js';
import { getPerson } from './identity-engine.js';

const log = createLogger('DECISION');

const rules = [];
const MAX_RULES = 200;

export function addRule({ name, condition, action, priority = 0, enabled = true, description = '' }) {
  if (rules.length >= MAX_RULES) rules.shift();
  const rule = { id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, condition, action, priority, enabled, description, created: Date.now() };
  rules.push(rule);
  rules.sort((a, b) => b.priority - a.priority);
  return rule.id;
}

export function removeRule(id) {
  const idx = rules.findIndex(r => r.id === id);
  if (idx !== -1) { rules.splice(idx, 1); return true; }
  return false;
}

export function getRules() { return [...rules]; }

export function enableRule(id) {
  const r = rules.find(r => r.id === id);
  if (r) { r.enabled = true; return true; }
  return false;
}

export function disableRule(id) {
  const r = rules.find(r => r.id === id);
  if (r) { r.enabled = false; return true; }
  return false;
}

export function addDefaultRules() {
  addRule({
    name: 'repondre_rapidement_proche',
    description: 'Repond rapidement aux contacts a haute frequence',
    priority: 10,
    condition: async (ctx) => {
      const person = await getPerson(ctx.senderJid);
      return person && person.frequency > 50 && ctx.text && ctx.text.length > 5 && !ctx.text.startsWith('.');
    },
    action: async (ctx) => {
      log.info(`[Decision] Contact proche ${ctx.senderJid} - priorite elevee`);
    },
  });

  addRule({
    name: 'detecter_urgence',
    description: 'Detecte les mots d urgence dans les messages',
    priority: 20,
    condition: async (ctx) => {
      const urgent = ['urgent', 'urgence', 'vite', 'vite vite', 'help', 'aide moi', 'probleme', 'urgence absolue', 'immédiatement', 'immediatement', 'stp aide', 'critical', 'crise'];
      const lower = (ctx.text || '').toLowerCase();
      return urgent.some(w => lower.includes(w));
    },
    action: async (ctx) => {
      log.warn(`[Decision] URGENCE detectee de ${ctx.senderJid}: ${(ctx.text || '').slice(0, 100)}`);
      bus.emit('alert:urgent', { jid: ctx.senderJid, text: ctx.text, context: getContext(ctx.senderJid)?.getSummary() });
    },
  });

  addRule({
    name: 'detecter_decision',
    description: 'Detecte quand une decision est prise dans la conversation',
    priority: 8,
    condition: async (ctx) => {
      const patterns = ['on va', 'nous allons', 'je vais', 'd accord', "d'accord", 'decide', 'décidé', 'ok pour', 'valide', 'confirmé', 'confirme', 'c est parti'];
      const lower = (ctx.text || '').toLowerCase();
      return patterns.some(p => lower.includes(p));
    },
    action: async (ctx) => {
      bus.emit(EVENTS.DECISION_MADE, { jid: ctx.senderJid, context: ctx.text });
    },
  });

  addRule({
    name: 'suggestion_aide',
    description: 'Propose de l aide quand l utilisateur semble bloque',
    priority: 5,
    condition: async (ctx) => {
      const stuck = ["je sais pas", "je ne sais pas", "j arrive pas", "j'y arrive pas", "comment faire", "aide moi", "explique"];
      const lower = (ctx.text || '').toLowerCase();
      return stuck.some(s => lower.includes(s));
    },
    action: async (ctx) => {
      log.info(`[Decision] Utilisateur bloque: ${ctx.senderJid}`);
    },
  });
}

export async function evaluate(ctx) {
  if (!ctx) return [];
  const triggered = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      const matches = await rule.condition(ctx);
      if (matches) {
        triggered.push(rule);
        try { await rule.action(ctx); } catch (err) {
          log.error(`[Decision] Action ${rule.name}: ${err.message}`);
        }
      }
    } catch (err) {
      log.error(`[Decision] Condition ${rule.name}: ${err.message}`);
    }
  }
  return triggered;
}

export function getStats() {
  return { totalRules: rules.length, enabled: rules.filter(r => r.enabled).length };
}
