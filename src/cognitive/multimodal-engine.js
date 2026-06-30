import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { semanticMemory } from './semantic-memory.js';
import { runtime } from './cognitive-runtime.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('MIE');

/* ════════════════════════════════════════════════════════════
   TYPES DE CONTENU DETECTABLES
════════════════════════════════════════════════════════════ */

const CONTENT_TYPES = {
  text: { patterns: [/^.{10,}$/], priority: 'normal' },
  image: { patterns: [/\.(png|jpg|jpeg|gif|webp|bmp)$/i, /^data:image/, /image\/.*/], priority: 'high' },
  pdf: { patterns: [/\.pdf$/i, /application\/pdf/], priority: 'high' },
  audio: { patterns: [/\.(mp3|wav|ogg|aac|m4a|opus)$/i, /audio\/.*/], priority: 'normal' },
  video: { patterns: [/\.(mp4|webm|avi|mkv|mov)$/i, /video\/.*/], priority: 'low' },
  document: { patterns: [/\.(docx?|xlsx?|pptx?|odt|ods)$/i], priority: 'normal' },
  code: { patterns: [/\.(js|py|ts|java|go|rs|cpp|c|rb|php|swift)$/i, /^import |^const |^function |^def |^pub /], priority: 'normal' },
  url: { patterns: [/^https?:\/\//i], priority: 'high' },
  email: { patterns: [/^[\w.-]+@[\w.-]+\.\w{2,}$/, /^\<mailto:/], priority: 'normal' },
  screenshot: { patterns: [/screenshot|capture.*ecran|capture.*screen/i], priority: 'high' },
  whatsapp: { patterns: [/whatsapp|wa\.me|chat\.whatsapp/i], priority: 'normal' },
};

/* ════════════════════════════════════════════════════════════
   COGNITIVE OBJECT — format universel
════════════════════════════════════════════════════════════ */

export class CognitiveObject {
  constructor(data = {}) {
    this.id = data.id || `co_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.type = data.type || 'unknown';
    this.content = data.content || null;
    this.mimeType = data.mimeType || null;
    this.source = data.source || null;
    this.author = data.author || null;
    this.timestamp = data.timestamp || Date.now();
    this.entities = data.entities || [];
    this.concepts = data.concepts || [];
    this.relations = data.relations || [];
    this.embeddings = data.embeddings || [];
    this.summary = data.summary || '';
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.pipeline = [];
  }

  addStep(step) { this.pipeline.push({ ...step, timestamp: Date.now() }); return this; }

  get pipelineSummary() { return this.pipeline.map(s => s.name).join(' → '); }

  toJSON() {
    return { id: this.type.substring(0, 8), type: this.type, summary: this.summary.substring(0, 80), entities: this.entities.length, concepts: this.concepts.length, tags: this.tags, pipeline: this.pipelineSummary };
  }

  persist() {
    rawRun(`INSERT INTO cognitive_objects (id, type, content, mime_type, source, author, entities, concepts, relations, summary, tags, metadata, pipeline, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.id, this.type, typeof this.content === 'string' ? this.content.slice(0, 5000) : JSON.stringify(this.content).slice(0, 5000),
      this.mimeType, this.source, this.author,
      JSON.stringify(this.entities), JSON.stringify(this.concepts),
      JSON.stringify(this.relations), this.summary,
      JSON.stringify(this.tags), JSON.stringify(this.metadata),
      JSON.stringify(this.pipeline), this.timestamp);
    return this;
  }
}

/* ════════════════════════════════════════════════════════════
   MULTIMODAL INTELLIGENCE ENGINE
════════════════════════════════════════════════════════════ */

export class MultimodalEngine {
  constructor() {
    this._analyzers = new Map();
    this._initDefaultAnalyzers();
  }

  _initDefaultAnalyzers() {
    this.registerAnalyzer('text', this._analyzeText.bind(this));
    this.registerAnalyzer('image', this._analyzeImage.bind(this));
    this.registerAnalyzer('pdf', this._analyzeDocument.bind(this));
    this.registerAnalyzer('audio', this._analyzeAudio.bind(this));
    this.registerAnalyzer('video', this._analyzeVideo.bind(this));
    this.registerAnalyzer('document', this._analyzeDocument.bind(this));
    this.registerAnalyzer('code', this._analyzeCode.bind(this));
    this.registerAnalyzer('url', this._analyzeUrl.bind(this));
    this.registerAnalyzer('email', this._analyzeEmail.bind(this));
  }

  registerAnalyzer(type, fn) { this._analyzers.set(type, fn); }

  detectType(input) {
    const raw = typeof input === 'string' ? input : input?.url || input?.content || input?.text || '';
    const mime = input?.mimeType || input?.mime || '';
    for (const [type, config] of Object.entries(CONTENT_TYPES)) {
      for (const pat of config.patterns) {
        if (pat.test(raw) || pat.test(mime)) return type;
      }
    }
    return 'text';
  }

  async perceive(input, options = {}) {
    const start = Date.now();
    const type = this.detectType(input);
    const rawContent = typeof input === 'string' ? input : (input.url || input.content || input.text || '');
    const co = new CognitiveObject({
      type,
      content: rawContent,
      mimeType: input?.mimeType || input?.mime || null,
      source: options.source || input?.source || 'direct',
      author: options.author || input?.author || null,
      timestamp: options.timestamp || Date.now(),
    });
    co.addStep({ name: 'detection', type, duration: Date.now() - start });

    const analyzer = this._analyzers.get(type);
    if (analyzer) {
      try {
        const result = await analyzer(input, co, options);
        co.addStep({ name: `analyze_${type}`, entities: co.entities.length, concepts: co.concepts.length, duration: Date.now() - start });
      } catch (err) {
        co.addStep({ name: `error_${type}`, error: err.message });
        log.error(`[MIE] Erreur analyse ${type}: ${err.message}`);
      }
    }

    co.addStep({ name: 'enrich', duration: Date.now() - start });
    await this._enrich(co, options);
    co.addStep({ name: 'store', duration: Date.now() - start });

    if (options.persist !== false) co.persist();
    bus.emit('cognitive:object_created', { id: co.id, type: co.type, summary: co.summary.slice(0, 80) });
    return co;
  }

  async _analyzeText(input, co, options) {
    const text = typeof co.content === 'string' ? co.content : '';
    if (!text) { co.summary = '[Contenu non textuel]'; return; }
    co.summary = text.length > 200 ? text.slice(0, 200) + '...' : text;
    try { co.entities = this._extractEntities(text); } catch {}
    try { co.concepts = this._extractConcepts(text); } catch {}
    try { co.tags = this._extractTags(text); } catch {}
    try { co.metadata.wordCount = text.split(/\s+/).length; } catch {}
    co.metadata.charCount = text.length;
    try { if (text.length > 50) await semanticMemory.embeddings.store('text', co.id, text); } catch {}
  }

  async _analyzeImage(input, co, options) {
    co.summary = 'Image reçue en attente d analyse visuelle';
    co.tags = ['image', options.source || 'unknown'];
    co.metadata.dimensions = input?.width || input?.height ? `${input.width}x${input.height}` : 'unknown';
    co.metadata.format = co.mimeType || 'unknown';
    co.addStep({ name: 'vision_pending', note: 'Analyse visuelle necessite API vision' });
  }

  async _analyzeDocument(input, co, options) {
    co.summary = `Document reçu (type: ${co.mimeType || 'inconnu'})`;
    co.tags = ['document', options.source || 'unknown'];
    co.concepts.push({ name: 'document', confidence: 0.9 });
    co.metadata.fileName = input?.fileName || input?.name || 'unknown';
  }

  async _analyzeAudio(input, co, options) {
    co.summary = 'Fichier audio reçu en attente de transcription';
    co.tags = ['audio', options.source || 'unknown'];
    co.concepts.push({ name: 'audio', confidence: 0.9 });
    co.metadata.duration = input?.duration || 'unknown';
    co.addStep({ name: 'transcription_pending', note: 'Transcription necessite API speech' });
  }

  async _analyzeVideo(input, co, options) {
    co.summary = 'Video reçue en attente d analyse';
    co.tags = ['video', options.source || 'unknown'];
    co.concepts.push({ name: 'video', confidence: 0.8 });
    co.metadata.duration = input?.duration || 'unknown';
  }

  async _analyzeCode(input, co, options) {
    const code = co.content || '';
    const lines = code.split('\n').length;
    co.summary = `Code (${lines} lignes)`;
    co.tags.push('code');
    co.concepts.push({ name: 'code', confidence: 0.9 });
    co.metadata.lines = lines;
    co.metadata.lang = this._detectLang(code);
  }

  async _analyzeUrl(input, co, options) {
    const url = co.content || '';
    co.summary = `URL: ${url.slice(0, 100)}`;
    co.tags.push('url');
    co.entities.push({ type: 'url', value: url, confidence: 1.0 });
    try {
      const parsed = new URL(url);
      co.metadata.domain = parsed.hostname;
      co.metadata.path = parsed.pathname;
      co.concepts.push({ name: parsed.hostname.replace('www.', ''), confidence: 0.7 });
    } catch {
      co.metadata.invalidUrl = true;
    }
  }

  async _analyzeEmail(input, co, options) {
    const email = co.content || '';
    co.summary = `Email: ${email.slice(0, 100)}`;
    co.tags.push('email');
    co.entities.push({ type: 'email', value: email, confidence: 1.0 });
    co.metadata.domain = email.split('@')[1] || 'unknown';
    co.concepts.push({ name: 'email_contact', confidence: 0.8 });
  }

  async _enrich(co, options) {
    for (const entity of co.entities) {
      const eType = String(entity.type || 'entity');
      const eId = String(entity.value || entity.name || 'unknown');
      try { await semanticMemory.mesh.link('cognitive_object', co.id, eType, eId, 'contains_entity', 0.8); } catch {}
    }
    for (const concept of co.concepts) {
      const cName = String(concept.name || 'unknown');
      try { await semanticMemory.mesh.link('cognitive_object', co.id, 'concept', cName, 'evokes_concept', concept.confidence || 0.5); } catch {}
    }
    if (co.author) {
      try { await semanticMemory.mesh.link('cognitive_object', co.id, 'person', String(co.author), 'authored_by', 1); } catch {}
    }
    try {
      semanticMemory.episodes.record('perception', `Objet cognitif: ${co.type}`, co.summary || '', co.source || '', co.entities || [], { objectId: co.id });
    } catch {}
  }

  _extractEntities(text) {
    if (typeof text !== 'string') return [];
    const entities = [];
    const patterns = {
      email: /[\w.-]+@[\w.-]+\.\w{2,}/g,
      phone: /(?:\+?\d{1,3}[\s-]?)?\d{7,14}/g,
      url: /https?:\/\/[^\s]+/g,
      amount: /\b(\d[\d.,]*)\s*(XAF|EUR|USD|GBP|FCFA|€|\$)\b/gi,
      date: /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
    };
    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches.slice(0, 5)) {
          entities.push({ type, value: m, confidence: 0.9 });
        }
      }
    }
    return entities;
  }

  _extractConcepts(text) {
    if (typeof text !== 'string') return [];
    const concepts = [];
    const triggers = {
      'facture': ['facture', 'invoice', 'bill', 'payer', 'payment'],
      'projet': ['projet', 'project', 'mission', 'tache', 'task'],
      'client': ['client', 'customer', 'vip', 'premium'],
      'urgent': ['urgent', 'asap', 'critical', 'important', 'vite'],
      'meeting': ['meeting', 'reunion', 'rendez-vous', 'appointment', 'rdv'],
      'vente': ['vente', 'sale', 'achat', 'purchase', 'commande', 'order'],
    };
    const lower = text.toLowerCase();
    for (const [name, keywords] of Object.entries(triggers)) {
      if (keywords.some(k => lower.includes(k))) concepts.push({ name, confidence: 0.6 });
    }
    return concepts;
  }

  _extractTags(text) {
    if (typeof text !== 'string') return [];
    const tags = [];
    const hashTags = text.match(/#\w+/g);
    if (hashTags) tags.push(...hashTags.map(t => t.slice(1)));
    return tags;
  }

  _detectLang(code) {
    const langHints = [
      { lang: 'javascript', patterns: ['const ', 'let ', 'import ', 'export ', 'function ', '=>'] },
      { lang: 'python', patterns: ['def ', 'import ', 'class ', 'if __name__', 'print('] },
      { lang: 'java', patterns: ['public class', 'private ', 'void main', '@Override'] },
      { lang: 'go', patterns: ['package ', 'func ', 'import (', 'defer '] },
      { lang: 'rust', patterns: ['fn ', 'let mut', 'pub fn', 'impl '] },
    ];
    for (const hint of langHints) {
      if (hint.patterns.some(p => code.includes(p))) return hint.lang;
    }
    return 'unknown';
  }

  async getObject(id) {
    const row = rawGet('SELECT * FROM cognitive_objects WHERE id = ?', id);
    if (!row) return null;
    return new CognitiveObject({
      id: row.id, type: row.type, content: row.content, mimeType: row.mime_type,
      source: row.source, author: row.author, entities: tryParse(row.entities, []),
      concepts: tryParse(row.concepts, []), relations: tryParse(row.relations, []),
      summary: row.summary, tags: tryParse(row.tags, []),
      metadata: tryParse(row.metadata, {}), timestamp: row.created_at,
    });
  }

  async search(query, type = null) {
    if (type) return rawAll("SELECT * FROM cognitive_objects WHERE type = ? AND (summary LIKE ? OR content LIKE ?) ORDER BY created_at DESC LIMIT 20", type, `%${query}%`, `%${query}%`);
    return rawAll("SELECT * FROM cognitive_objects WHERE summary LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20", `%${query}%`, `%${query}%`);
  }
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export const multimodal = new MultimodalEngine();
export { CONTENT_TYPES };
export default multimodal;
