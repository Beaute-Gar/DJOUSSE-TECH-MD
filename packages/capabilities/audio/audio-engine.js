import { createLogger } from '../../ainoria-intelligence/core/logger.js';
import { CognitiveObject } from '../vision/multimodal-engine.js';
import { semanticMemory } from '../../ainoria-intelligence/memory/semantic-memory.js';
import { bus } from '../../ainoria-intelligence/core/event-bus.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const log = createLogger('AUDIO');

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const TEMP_DIR = '/tmp/djousse_audio';
const TRANSCRIPTION_CACHE = 'audio_transcription_cache';
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp3'];

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

export class AudioEngine {
  constructor(dbService) {
    this.dbService = dbService;
    this.whisperApiKey = process.env.OPENAI_API_KEY || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
  }

  async transcribeAudio(audioInput, options = {}) {
    const start = Date.now();
    let audioBuffer;
    let audioType = options.mimeType || 'audio/mpeg';

    try {
      audioBuffer = await this._resolveAudio(audioInput, options);
      if (!audioBuffer) return { error: 'Impossible de résoudre la source audio' };

      if (audioBuffer.length > MAX_AUDIO_SIZE) {
        return { error: `Audio trop volumineux: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB (max: 25MB)` };
      }

      const audioHash = this._hashAudio(audioBuffer);
      const cached = await this._getCachedTranscription(audioHash);
      if (cached) {
        log.info(`Transcription trouvée en cache pour ${audioHash.slice(0, 12)}...`);
        return cached;
      }

      const tempPath = path.join(TEMP_DIR, `${audioHash}.mp3`);
      fs.writeFileSync(tempPath, audioBuffer);

      let transcription, analysis;

      if (this.whisperApiKey && this.whisperApiKey !== 'votre_cle_openai') {
        transcription = await this._transcribeWithWhisper(tempPath);
      } else {
        transcription = await this._transcribeWithGemini(audioBuffer, audioType);
      }

      if (transcription.error) {
        fs.unlinkSync(tempPath);
        return transcription;
      }

      if (this.geminiApiKey && transcription.text) {
        analysis = await this._analyzeWithGemini(transcription.text);
      }

      const result = {
        audioHash,
        audioType,
        timestamp: Date.now(),
        transcription: transcription.text,
        language: transcription.language || 'fr',
        duration: transcription.duration || 0,
        subject: analysis?.subject || 'Message vocal',
        urgency: analysis?.urgency || 'normale',
        emotion: analysis?.emotion || 'neutre',
        actions: analysis?.actions || [],
        summary: analysis?.summary || transcription.text.slice(0, 100),
        relevance: analysis?.relevance || 'normal',
      };

      await this._cacheTranscription(audioHash, result);

      const co = new CognitiveObject({
        type: 'audio_transcription',
        content: transcription.text,
        source: options.source || 'audio',
        author: options.author || 'system',
        timestamp: Date.now(),
        summary: result.summary,
        tags: ['audio', 'transcription', 'ai_analyzed'],
        metadata: { duration: Date.now() - start, language: result.language, urgency: result.urgency, emotion: result.emotion, subject: result.subject },
      });
      co.persist();
      await semanticMemory.mesh.link('cognitive_object', co.id, 'concept', 'audio_transcription', 'generated_by', 0.9);
      bus.emit('audio:transcribed', { id: co.id, summary: result.summary.slice(0, 80) });

      fs.unlinkSync(tempPath);
      return result;

    } catch (err) {
      log.error(`Transcription audio échouée: ${err.message}`);
      return { error: err.message };
    }
  }

  async _resolveAudio(input, options) {
    if (typeof input === 'string' && input.startsWith('http')) {
      const resp = await axios.get(input, { responseType: 'arraybuffer', timeout: 30000 });
      return Buffer.from(resp.data);
    }
    if (typeof input === 'string' && input.includes('base64,')) {
      return Buffer.from(input.split('base64,').pop(), 'base64');
    }
    if (input instanceof Buffer) return input;
    if (input?.buffer) return input.buffer;
    if (options.url) {
      const resp = await axios.get(options.url, { responseType: 'arraybuffer', timeout: 30000 });
      return Buffer.from(resp.data);
    }
    return null;
  }

  async _transcribeWithWhisper(filePath) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('model', 'whisper-1');
      form.append('language', 'fr');
      form.append('response_format', 'json');
      form.append('temperature', '0.2');

      const response = await axios.post(WHISPER_ENDPOINT, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.whisperApiKey}`,
        },
        timeout: 60000,
      });

      return {
        text: response.data.text,
        language: response.data.language || 'fr',
        duration: 0,
      };
    } catch (err) {
      log.error(`Whisper échoué, fallback Gemini: ${err.message}`);
      return { error: err.message };
    }
  }

  async _transcribeWithGemini(buffer, mimeType) {
    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcris précisément tout ce qui est dit dans cet audio en français.' },
              { inlineData: { mimeType, data: buffer.toString('base64') } },
            ],
          }],
        }),
      });

      if (!response.ok) return { error: `Gemini API: ${response.status}` };
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text, language: 'fr', duration: 0 };
    } catch (err) {
      return { error: err.message };
    }
  }

  async _analyzeWithGemini(transcription) {
    try {
      const prompt = `Analyse ce message vocal transcrit et fournis:
1. Le sujet principal (1-2 mots)
2. L'urgence (basse/normale/haute)
3. L'émotion détectée (neutre/positif/négatif/urgent)
4. Les actions à prendre si pertinent
5. Un résumé en 1 phrase
6. Pertinence pour le groupe (important/normal/spam)

Texte transcrit: "${transcription}"

Format JSON: { "subject": "...", "urgency": "...", "emotion": "...", "actions": [...], "summary": "...", "relevance": "..." }`;

      const response = await fetch(`${GEMINI_ENDPOINT}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
      return JSON.parse(jsonMatch ? jsonMatch[1] : text);
    } catch {
      return null;
    }
  }

  _hashAudio(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async _getCachedTranscription(hash) {
    if (!this.dbService) return null;
    try {
      return await this.dbService.get(TRANSCRIPTION_CACHE, hash);
    } catch { return null; }
  }

  async _cacheTranscription(hash, data) {
    if (!this.dbService) return;
    try {
      await this.dbService.save(TRANSCRIPTION_CACHE, hash, { ...data, cachedAt: Date.now() });
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
        if (now - stat.mtimeMs > maxAge) { fs.unlinkSync(fp); log.info(`Fichier audio temporaire supprimé: ${file}`); }
      }
    } catch (err) { log.error(`Nettoyage audio: ${err.message}`); }
  }
}

export const audio = new AudioEngine();
export default audio;
