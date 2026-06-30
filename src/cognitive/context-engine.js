import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { storeShortTerm, getShortTerm, storeLongTerm } from './memory-engine.js';

const log = createLogger('CONTEXT');

const contexts = new Map();
const MAX_CONTEXT_MSGS = 20;
const CONTEXT_TTL = 900_000;

export class ConversationContext {
  constructor(jid) {
    this.jid = jid;
    this.messages = [];
    this.topic = null;
    this.topics = [];
    this.sentiment = 'neutral';
    this.sentimentScore = 0;
    this.entities = [];
    this.activeProject = null;
    this.lastActivity = Date.now();
    this.turnCount = 0;
    this.participants = new Set();
    this.labels = [];
  }

  addMessage(senderJid, text, type = 'text') {
    this.messages.push({ sender: senderJid, text, type, timestamp: Date.now() });
    if (this.messages.length > MAX_CONTEXT_MSGS) this.messages.shift();
    this.participants.add(senderJid);
    this.lastActivity = Date.now();
    this.turnCount++;
    this._extractEntities(text);
    return this;
  }

  _extractEntities(text) {
    const patterns = {
      amount: /(\d[\d\s]*)\s*(fcfa|eur|usd|xaf|xof|euro|\$|€)/gi,
      date: /(\d{1,2})\s*(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s*(\d{2,4})?|\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b|\b(aujourd'hui|demain|hier|apres-demain|après-demain)\b/gi,
      time: /(\d{1,2})[h:](\d{0,2})\s*(mn|min)?/gi,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phone: /(\+?\d{1,3})?[\s.-]?\d{3,4}[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,3}/g,
      url: /(https?:\/\/[^\s]+)/g,
    };
    for (const [type, regex] of Object.entries(patterns)) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const value = match[0].trim();
        if (!this.entities.find(e => e.type === type && e.value === value)) {
          this.entities.push({ type, value, timestamp: Date.now() });
        }
      }
    }
  }

  detectTopic() {
    const words = this.messages.slice(-5).map(m => m.text.toLowerCase()).join(' ').split(/\s+/);
    const freq = {};
    const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est', 'a', 'dans', 'pour', 'sur', 'avec', 'pas', 'que', 'qui', 'quoi', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce', 'cet', 'cette', 'ses', 'son', 'sa', 'me', 'te', 'se', 'en', 'y', 'au', 'aux', 'mais', 'ou', 'donc', 'car', 'ni', 'or']);
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) this.topic = sorted[0][0];
    return this.topic;
  }

  analyzeSentiment() {
    const positive = new Set(['merci', 'bravo', 'genial', 'super', 'parfait', 'excellent', 'bon', 'bien', 'cool', 'top', 'ok', 'daccord', 'd\'accord', 'oui', 'yes', 'love', '❤️', '✅', '👍', 'super']);
    const negative = new Set(['non', 'probleme', 'problème', 'pas bien', 'mauvais', 'triste', 'colere', 'colère', 'facher', 'fâché', 'enerve', 'énervé', 'insulte', 'pourri', 'nul', 'nulle', 'jamais', 'rien', '❌', '😡', '😠', '👎']);
    let score = 0;
    let count = 0;
    for (const msg of this.messages.slice(-10)) {
      const words = msg.text.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (positive.has(w)) { score++; count++; }
        if (negative.has(w)) { score--; count++; }
      }
    }
    this.sentimentScore = count > 0 ? score / count : 0;
    if (this.sentimentScore > 0.15) this.sentiment = 'positive';
    else if (this.sentimentScore < -0.15) this.sentiment = 'negative';
    else this.sentiment = 'neutral';
    return this.sentiment;
  }

  getSummary() {
    return {
      jid: this.jid,
      messageCount: this.messages.length,
      topic: this.topic,
      sentiment: this.sentiment,
      sentimentScore: this.sentimentScore,
      entities: this.entities.slice(-10),
      activeProject: this.activeProject,
      participants: [...this.participants],
      lastActivity: this.lastActivity,
      turnCount: this.turnCount,
      labels: this.labels,
    };
  }

  isExpired() {
    return Date.now() - this.lastActivity > CONTEXT_TTL;
  }
}

export function getContext(jid) {
  if (!contexts.has(jid)) contexts.set(jid, new ConversationContext(jid));
  const ctx = contexts.get(jid);
  if (ctx.isExpired()) {
    contexts.delete(jid);
    const nctx = new ConversationContext(jid);
    contexts.set(jid, nctx);
    return nctx;
  }
  return ctx;
}

export function addToContext(jid, senderJid, text, type = 'text') {
  const ctx = getContext(jid);
  ctx.addMessage(senderJid, text, type);
  storeShortTerm(jid, 'context', ctx.getSummary());
  if (ctx.turnCount % 5 === 0) {
    ctx.detectTopic();
    ctx.analyzeSentiment();
  }
  return ctx;
}

export function removeContext(jid) { contexts.delete(jid); }

export function getActiveContexts() {
  const active = [];
  for (const [jid, ctx] of contexts) {
    if (!ctx.isExpired()) active.push(ctx.getSummary());
  }
  return active;
}

export function labelContext(jid, label) {
  const ctx = getContext(jid);
  if (!ctx.labels.includes(label)) ctx.labels.push(label);
}

export function findContextsByLabel(label) {
  const results = [];
  for (const [jid, ctx] of contexts) {
    if (!ctx.isExpired() && ctx.labels.includes(label)) results.push(ctx.getSummary());
  }
  return results;
}

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.senderJid && data.text) {
    addToContext(data.senderJid, data.senderJid, data.text, data.type || 'text');
    if (data.isGroup && data.jid) {
      addToContext(data.jid, data.senderJid, data.text, data.type || 'text');
    }
  }
});
