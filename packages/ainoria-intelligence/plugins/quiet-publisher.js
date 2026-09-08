import { createLogger } from '../../infrastructure/logger.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';

const log = createLogger('PLUGIN:QUIETPUB');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

const FALLBACK_IMAGES = {
  gaming: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800',
  roblox: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  anime: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
  famille: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800',
  travail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800',
  commerce: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
  education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
  sport: 'https://images.unsplash.com/photo-1461896836934-bd45ba05cf21?w=800',
  technologie: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  religion: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800',
  musique: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
  general: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
};

const CONTENT_TYPES = ['actualite', 'tendance', 'astuce', 'info', 'curiosite'];
const QUIET_THRESHOLD_MS = 45 * 60 * 1000;
const MIN_INTERVAL_BETWEEN_POSTS_MS = 4 * 60 * 60 * 1000;

const _groupActivity = new Map();
const _lastPost = new Map();
const _contentCycle = new Map();

export function registerQuietPublisher(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, (data) => {
    if (!data) return;
    const { jid, isGroup } = data;
    if (!isGroup || !jid) return;
    _groupActivity.set(jid, Date.now());
  }, { priority: 100, description: 'quiet-publisher-track' });

  pipeline.on('heartbeat:five_minutes', async () => {
    try {
      const { cm } = await import('../../core/handler.js');
      const activated = _getActivatedGroups(cm);
      const now = Date.now();

      for (const { jid, name, type } of activated) {
        const lastActive = _groupActivity.get(jid) || 0;
        const quietDuration = now - lastActive;
        if (quietDuration < QUIET_THRESHOLD_MS) continue;

        const lastPostTime = _lastPost.get(jid) || 0;
        if (now - lastPostTime < MIN_INTERVAL_BETWEEN_POSTS_MS) continue;

        const contentType = _nextContentType(jid);
        try {
          await _publish(jid, name, type, contentType);
          _lastPost.set(jid, now);
          log.info(`Publication calme: ${name} (${type}) [${contentType}]`);
        } catch (e) {
          log.warn(`Publication échouée pour ${name}: ${e.message}`);
        }
      }
    } catch (e) {
      log.warn(`quiet-publisher heartbeat: ${e.message}`);
    }
  }, { priority: 20, description: 'quiet-publisher' });
}

function _nextContentType(jid) {
  const idx = (_contentCycle.get(jid) || 0) % CONTENT_TYPES.length;
  _contentCycle.set(jid, idx + 1);
  return CONTENT_TYPES[idx];
}

function _getActivatedGroups(cm) {
  try {
    const groups = cm.getActivatedGroups ? cm.getActivatedGroups() : {};
    return Object.entries(groups).map(([jid, g]) => ({
      jid,
      name: g.groupName || 'Groupe',
      type: g.groupType || 'general',
    })).filter(g => g.jid);
  } catch {
    return [];
  }
}

async function _publish(jid, name, type, contentType) {
  const content = await _generateContent(name, type, contentType);
  const sendAsVoice = Math.random() < 0.3;

  if (sendAsVoice) {
    try {
      const { genererVocal } = await import('../../core/voice-persona.js');
      const voiceProfile = type === 'famille' || type === 'education' ? 'douce' :
                           type === 'sport' ? 'dynamique' : 'homme';
      const audioBuf = await genererVocal(content, voiceProfile);
      if (audioBuf && audioBuf.length > 100) {
        await executor.execute({
          type: ACTION_TYPES.SEND_AUDIO,
          payload: { jid, buffer: audioBuf, mimetype: 'audio/ogg', ptt: true },
          source: 'quiet-publisher',
        });
        return;
      }
    } catch {}
  }

  const imageUrl = await _fetchImage(type);
  const caption = imageUrl ? `${content}\n\n📸 DJOUSSE TECH` : content;

  try {
    if (imageUrl) {
      try {
        await executor.execute({
          type: ACTION_TYPES.SEND_IMAGE,
          payload: { jid, url: imageUrl, caption },
          source: 'quiet-publisher',
        });
      } catch {
        await executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid, text: caption },
          source: 'quiet-publisher',
        });
      }
    } else {
      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid, text: caption },
        source: 'quiet-publisher',
      });
    }
  } catch {}
}

async function _generateContent(name, type, contentType) {
  const news = await _fetchNews(type, contentType);
  if (news) return news;

  const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return _fallbackContent(type, contentType);

  const toneMap = {
    actualite: 'informatif et concis',
    tendance: 'actuel et pertinent',
    astuce: 'pratique et utile',
    info: 'clair et intéressant',
    curiosite: 'surprenant et captivant',
  };
  const tone = toneMap[contentType] || 'naturel';

  const basePrompt = `Tu es DJOUSSE TECH. Génère un message ${tone} (2-4 phrases) pour le groupe WhatsApp "${name}" qui est un groupe de type "${type}". Ne mentionne pas que tu es une IA. Parle comme un membre du groupe.`;
  const typePrompts = {
    gaming: 'Parle d\'actualité gaming, astuces de jeu, tendances e-sport.',
    roblox: 'Parle des nouveautés Roblox, astuces de jeu, événements.',
    anime: 'Parle des sorties anime, recommandations, culture otaku.',
    famille: 'Sujet familial chaleureux, conseils, partage.',
    travail: 'Actualité professionnelle, conseils carrière, productivité.',
    education: 'Astuces d\'étude, actualité éducative, conseils apprentissage.',
    sport: 'Actualité sportive, conseils entraînement, nutrition.',
    technologie: 'Nouveautés tech, gadgets, astuces numériques.',
    musique: 'Sorties musicales, recommandations, culture musicale.',
    general: 'Sujet intéressant et varié adapté à tous.',
  };
  const typePrompt = typePrompts[type] || typePrompts.general;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: `${basePrompt}\n${typePrompt}\nFormat: texte seulement, pas de salutation.` },
          { role: 'user', content: `Génère une ${contentType} pour ce groupe.` },
        ],
        temperature: 0.8, max_completion_tokens: 400,
      }),
    });
    if (!res.ok) return _fallbackContent(type, contentType);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || _fallbackContent(type, contentType);
  } catch {
    return _fallbackContent(type, contentType);
  }
}

async function _fetchNews(type, contentType) {
  if (!SERPAPI_KEY) return null;
  const queries = {
    gaming: 'actualité jeux vidéo 2026', roblox: 'Roblox news 2026',
    anime: 'actualité anime 2026', famille: 'conseils famille 2026',
    travail: 'actualité emploi 2026', education: 'actualité éducation 2026',
    sport: 'actualité sportive 2026', technologie: 'actualité tech 2026',
    musique: 'actualité musique 2026', general: 'actualité 2026',
  };
  const query = queries[type] || queries.general;
  if (contentType !== 'actualite' && contentType !== 'tendance') return null;

  try {
    const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&tbm=nws&num=3&hl=fr`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.news_results || [];
    if (results.length === 0) return null;
    const top = results.slice(0, 2);
    return `📰 *Actualités ${type}*\n\n${top.map((r, i) => `${i + 1}. ${r.title}\n   ${r.source || ''}`).join('\n\n')}\n\n💡 Via DJOUSSE TECH`;
  } catch {
    return null;
  }
}

function _fallbackContent(type, contentType) {
  const fallbacks = {
    gaming: {
      actualite: '🎮 Découvrez les dernières sorties du moment !',
      tendance: '🔥 Le jeu du moment fait vibrer la communauté.',
      astuce: '💡 Astuce : prenez le temps d\'explorer chaque niveau.',
      info: '📊 Les jeux indépendants gagnent en popularité.',
      curiosite: '🤔 Saviez-vous que le premier jeu vidéo date de 1958 ?',
    },
    famille: {
      actualite: '👨‍👩‍👧‍👦 Passez un bon moment en famille !',
      tendance: '🌟 Les activités familiales créent des souvenirs.',
      astuce: '💡 Conseil : un repas partagé chaque semaine renforce les liens.',
      info: '📊 Les enfants qui lisent en famille développent plus de vocabulaire.',
      curiosite: '🤔 Le saviez-vous ? Le rire renforce les liens familiaux.',
    },
  };
  const tpl = fallbacks[type] || fallbacks.gaming;
  return tpl[contentType] || '💬 Bonjour à tous !';
}

async function _fetchImage(type) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.general;

  const queries = {
    gaming: 'video game', roblox: 'online game', anime: 'anime art',
    famille: 'family together', travail: 'office work', commerce: 'shopping',
    education: 'study', sport: 'sport', technologie: 'technology',
    religion: 'spiritual', musique: 'music', general: 'nature landscape',
  };
  const query = queries[type] || 'nature';

  try {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&count=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.general;
    const data = await res.json();
    return data?.urls?.regular || FALLBACK_IMAGES[type] || FALLBACK_IMAGES.general;
  } catch {
    return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.general;
  }
}
