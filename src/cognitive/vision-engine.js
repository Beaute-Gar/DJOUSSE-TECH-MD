import { createLogger } from '../core/logger.js';
import { CognitiveObject } from './multimodal-engine.js';
import { semanticMemory } from './semantic-memory.js';
import { bus } from './event-bus.js';

const log = createLogger('VISION');

let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export class VisionEngine {
  async analyze(imageData, options = {}) {
    const start = Date.now();
    const isUrl = typeof imageData === 'string' && imageData.startsWith('http');
    const isBase64 = typeof imageData === 'string' && imageData.includes('base64,');
    const isBuffer = imageData instanceof Buffer || imageData?.buffer;

    let prompt = options.prompt || 'Décris précisément ce que tu vois dans cette image.';
    if (options.ocr) prompt = 'Extrais tout le texte visible dans cette image, sans ajouter de commentaire.';
    if (options.analyze) prompt = `Analyse cette image: ${options.analyze}\n\nExtrais: 1) Description 2) Texte visible 3) Entités identifiées 4) Concepts clés`;

    const parts = [{ text: prompt }];

    if (isUrl) {
      parts.push({ inlineData: { mimeType: options.mimeType || 'image/jpeg', data: await this._fetchAsBase64(imageData) } });
    } else if (isBase64) {
      const data = imageData.split('base64,').pop();
      parts.push({ inlineData: { mimeType: options.mimeType || 'image/jpeg', data } });
    } else if (isBuffer) {
      const buf = imageData.buffer || imageData;
      parts.push({ inlineData: { mimeType: options.mimeType || 'image/png', data: buf.toString('base64') } });
    } else {
      return { error: 'Unsupported image format', type: typeof imageData };
    }

    try {
      const response = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { error: `Gemini API: ${response.status}`, details: errText };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const co = new CognitiveObject({
        type: options.ocr ? 'ocr' : 'vision',
        content: text,
        source: options.source || 'vision',
        author: options.author || 'system',
        timestamp: Date.now(),
        summary: text.slice(0, 300),
        tags: options.ocr ? ['ocr', 'text_extracted'] : ['vision', 'ai_analyzed'],
        metadata: { duration: Date.now() - start, prompt, model: 'gemini-1.5-flash' },
      });

      if (text.length > 20) {
        const entities = this._extractEntities(text);
        if (entities.length > 0) co.entities = entities;
        const concepts = this._extractConcepts(text);
        if (concepts.length > 0) co.concepts = concepts;
      }

      co.persist();
      await semanticMemory.mesh.link('cognitive_object', co.id, 'concept', `vision_${options.ocr ? 'ocr' : 'analysis'}`, 'generated_by', 0.9);
      bus.emit('vision:completed', { id: co.id, type: co.type, summary: co.summary.slice(0, 80) });

      return { text, object: co.toJSON(), duration: Date.now() - start };

    } catch (err) {
      log.error(`[VISION] API error: ${err.message}`);
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
    const isBase64 = typeof audioBuffer === 'string' && audioBuffer.includes('base64,');
    const data = isBase64 ? audioBuffer.split('base64,').pop() : (audioBuffer?.buffer || audioBuffer).toString('base64');

    try {
      const response = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: options.prompt || 'Transcris précisément tout ce qui est dit dans cet audio.' },
              { inlineData: { mimeType: options.mimeType || 'audio/mp3', data } },
            ],
          }],
        }),
      });

      if (!response.ok) return { error: `Gemini API: ${response.status}` };
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const co = new CognitiveObject({
        type: 'transcription', content: text, source: options.source || 'audio',
        author: options.author || 'system', timestamp: Date.now(),
        summary: text.slice(0, 300), tags: ['audio', 'transcription'],
      });
      co.persist();

      return { text, object: co.toJSON() };
    } catch (err) {
      return { error: err.message };
    }
  }

  async _fetchAsBase64(url) {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    return Buffer.from(buf).toString('base64');
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
