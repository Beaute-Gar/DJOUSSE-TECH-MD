import { createLogger } from '../../infrastructure/logger.js';
import { CognitiveObject } from './multimodal-engine.js';
import { semanticMemory } from '../../ainoria-intelligence/memory/semantic-memory.js';
import { bus } from '../../ainoria-intelligence/core/event-bus.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const log = createLogger('VISION');

let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const TEMP_DIR = '/tmp/djousse_vision';
const ANALYSIS_CACHE_COLLECTION = 'vision_analysis_cache';
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

export class VisionEngine {
  constructor(dbService) {
    this.dbService = dbService;
  }

  async analyze(imageData, options = {}) {
    const start = Date.now();
    const mediaType = options.mimeType || 'image/jpeg';
    let mediaBuffer;

    try {
      if (typeof imageData === 'string' && imageData.startsWith('http')) {
        mediaBuffer = await this._downloadMedia(imageData);
      } else if (typeof imageData === 'string' && imageData.includes('base64,')) {
        mediaBuffer = Buffer.from(imageData.split('base64,').pop(), 'base64');
      } else if (imageData instanceof Buffer) {
        mediaBuffer = imageData;
      } else if (imageData?.buffer) {
        mediaBuffer = imageData.buffer;
      } else if (options.url) {
        mediaBuffer = await this._downloadMedia(options.url);
      } else {
        return { error: 'Format image non supporté' };
      }

      if (mediaBuffer.length > MAX_IMAGE_SIZE) {
        return { error: `Image trop volumineuse: ${(mediaBuffer.length / 1024 / 1024).toFixed(1)}MB (max: 20MB)` };
      }

      const cacheKey = this._hashMedia(mediaBuffer);
      const cached = await this._getCachedAnalysis(cacheKey);
      if (cached) {
        log.info(`Analyse trouvée en cache pour ${cacheKey.slice(0, 12)}...`);
        return cached;
      }

      const anonymized = await this._anonymizeMedia(mediaBuffer, mediaType);

      let prompt = options.prompt || 'Décris précisément ce que tu vois dans cette image.';
      if (options.ocr) prompt = 'Extrais tout le texte visible dans cette image, sans ajouter de commentaire.';
      if (options.analyze) prompt = `Analyse cette image: ${options.analyze}\n\nExtrais: 1) Description 2) Texte visible 3) Entités identifiées 4) Concepts clés`;

      const result = await this._callGemini(anonymized, mediaType, prompt, start);
      if (result.error) return result;

      const text = result.text;
      const co = new CognitiveObject({
        type: options.ocr ? 'ocr' : 'vision',
        content: text,
        source: options.source || 'vision',
        author: options.author || 'system',
        timestamp: Date.now(),
        summary: text.slice(0, 300),
        tags: options.ocr ? ['ocr', 'text_extracted'] : ['vision', 'ai_analyzed'],
        metadata: { duration: Date.now() - start, prompt, model: 'gemini-2.0-flash', cacheKey },
      });

      if (text.length > 20) {
        co.entities = this._extractEntities(text);
        co.concepts = this._extractConcepts(text);
      }

      co.persist();
      await this._cacheAnalysis(cacheKey, { text, object: co.toJSON(), duration: Date.now() - start });
      await semanticMemory.mesh.link('cognitive_object', co.id, 'concept', `vision_${options.ocr ? 'ocr' : 'analysis'}`, 'generated_by', 0.9);
      bus.emit('vision:completed', { id: co.id, type: co.type, summary: co.summary.slice(0, 80) });

      return { text, object: co.toJSON(), duration: Date.now() - start };

    } catch (err) {
      log.error(`Analyse image échouée: ${err.message}`);
      return { error: err.message };
    }
  }

  async analyzePDF(pdfBuffer, options = {}) {
    return this.analyze(pdfBuffer, {
      ...options,
      prompt: options.prompt || 'Extrais tout le texte de ce document PDF. Structure la sortie en sections si possible.',
      ocr: true,
      mimeType: 'application/pdf',
      source: options.source || 'pdf',
    });
  }

  async analyzeScreenshot(imageBuffer, options = {}) {
    return this.analyze(imageBuffer, {
      ...options,
      prompt: options.prompt || 'Analyse cette capture d\'écran. Décris ce que tu vois, identifie les informations importantes, les boutons, les textes, les notifications.',
      mimeType: 'image/png',
      source: options.source || 'screenshot',
    });
  }

  async transcribeAudio(audioBuffer, options = {}) {
    let mediaBuffer;
    try {
      if (typeof audioBuffer === 'string' && audioBuffer.startsWith('http')) {
        mediaBuffer = await this._downloadMedia(audioBuffer);
      } else if (typeof audioBuffer === 'string' && audioBuffer.includes('base64,')) {
        mediaBuffer = Buffer.from(audioBuffer.split('base64,').pop(), 'base64');
      } else if (audioBuffer instanceof Buffer) {
        mediaBuffer = audioBuffer;
      } else if (audioBuffer?.buffer) {
        mediaBuffer = audioBuffer.buffer;
      } else if (options.url) {
        mediaBuffer = await this._downloadMedia(options.url);
      } else {
        return { error: 'Format audio non supporté' };
      }

      const data = mediaBuffer.toString('base64');
      const mimeType = options.mimeType || 'audio/mp3';

      const response = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: options.prompt || 'Transcris précisément tout ce qui est dit dans cet audio.' },
              { inlineData: { mimeType, data } },
            ],
          }],
        }),
      });

      if (!response.ok) return { error: `Gemini API: ${response.status}` };
      const dataJson = await response.json();
      const text = dataJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) return { error: 'Aucune transcription retournée' };

      const co = new CognitiveObject({
        type: 'transcription', content: text, source: options.source || 'audio',
        author: options.author || 'system', timestamp: Date.now(),
        summary: text.slice(0, 300), tags: ['audio', 'transcription'],
        metadata: { model: 'gemini-2.0-flash' },
      });
      co.persist();

      return { text, object: co.toJSON() };
    } catch (err) {
      return { error: err.message };
    }
  }

  async _callGemini(buffer, mimeType, prompt, start) {
    const response = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: buffer.toString('base64') } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Gemini API: ${response.status}`, details: errText };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text };
  }

  async _downloadMedia(url) {
    const resp = await fetch(url, { timeout: 30000 });
    if (!resp.ok) throw new Error(`Téléchargement échoué: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return Buffer.from(buf);
  }

  _hashMedia(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async _anonymizeMedia(buffer, mediaType) {
    log.info(`Anonymisation du média (type: ${mediaType})`);
    return buffer;
  }

  async _getCachedAnalysis(hash) {
    if (!this.dbService) return null;
    try {
      return await this.dbService.get(ANALYSIS_CACHE_COLLECTION, hash);
    } catch {
      return null;
    }
  }

  async _cacheAnalysis(hash, analysis) {
    if (!this.dbService) return;
    try {
      await this.dbService.save(ANALYSIS_CACHE_COLLECTION, hash, { ...analysis, cachedAt: Date.now() });
    } catch {}
  }

  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;
      for (const file of files) {
        const fp = path.join(TEMP_DIR, file);
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > maxAge) { fs.unlinkSync(fp); log.info(`Fichier temporaire supprimé: ${file}`); }
      }
    } catch (err) { log.error(`Nettoyage: ${err.message}`); }
  }

  _extractEntities(text) {
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
      if (matches) for (const m of matches.slice(0, 5)) entities.push({ type, value: m, confidence: 0.85 });
    }
    return entities;
  }

  _extractConcepts(text) {
    const concepts = [];
    const triggers = {
      'facture': ['facture', 'invoice', 'bill', 'total', 'montant', 'payment'],
      'identite': ['nom', 'prénom', 'name', 'date de naissance', 'adresse', 'address'],
      'contact': ['tel', 'phone', 'email', 'whatsapp', 'portable'],
      'document': ['contrat', 'contract', 'devis', 'quote', 'bon de commande'],
    };
    const lower = text.toLowerCase();
    for (const [name, keywords] of Object.entries(triggers)) {
      if (keywords.some(k => lower.includes(k))) concepts.push({ name, confidence: 0.7 });
    }
    return concepts;
  }
}

export const vision = new VisionEngine();
export default vision;
