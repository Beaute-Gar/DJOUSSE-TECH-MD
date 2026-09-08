import { createLogger } from '../../infrastructure/logger.js';
import { EVENTS } from './event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';
import { clock } from './cognitive-clock.js';
import { semanticMemory } from '../memory/semantic-memory.js';

const log = createLogger('MEMORY:SEARCH');
const _recentRecall = new Map();

export function registerMemorySearch(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup } = data;
    if (!text || text.startsWith('.') || text.length < 15) return;

    const intent = _detectRecallIntent(text);
    if (!intent) return;

    try {
      let results = [];

      if (intent.type === 'episode') {
        results = await _searchEpisodes(intent.query, senderJid, jid);
      } else if (intent.type === 'conversation') {
        results = await _searchConversations(intent.query, senderJid, jid);
      } else if (intent.type === 'date') {
        results = await _searchByDate(intent.query, senderJid, jid);
      } else if (intent.type === 'person') {
        results = await _searchByPerson(intent.query, senderJid, jid);
      }

      if (results.length === 0) return;

      const best = results[0];
      const recallKey = `${senderJid}:${best.id || best.title}`;
      if (_recentRecall.has(recallKey) && clock.now() - _recentRecall.get(recallKey) < 86400000) return;
      _recentRecall.set(recallKey, clock.now());

      const msg = _formatRecall(best, intent);
      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid, text: msg },
        source: 'memory-search',
      });
    } catch (err) {
      log.warn(`[MEMORY:SEARCH] ${err.message}`);
    }
  }, { priority: 8, description: 'memory-search' });
}

function _detectRecallIntent(text) {
  const t = text.toLowerCase().trim();

  const episodePatterns = [
    /(c'était quand|quand est-ce qu'on|date de|rappelle-moi.*(?:conversation|discussion|sujet))/,
    /(souviens-toi.*de|rappelle.*ce|on avait parlé de|on a déjà parlé)/,
    /(qu'est-ce que.*(?:disait|disais|avait dit|avais dit|s'était passé))/,
    /(est-ce que.*(?:déjà|avant|précédemment|auparavant))/,
  ];
  for (const p of episodePatterns) {
    if (p.test(t)) return { type: 'episode', query: t };
  }

  const conversationPatterns = [
    /(qu'est-ce qu'il (?:a dit|disait)|que (?:disait|disais)-il|contenu du message)/,
    /(recherche.*message|trouve.*conversation|cherche.*discussion)/,
    /(texte.*(?:ancien|précédent|envoyé|reçu))/,
  ];
  for (const p of conversationPatterns) {
    if (p.test(t)) return { type: 'conversation', query: t };
  }

  const datePatterns = [
    /(hier|avant-hier|cette semaine|la semaine dernière|ce mois-ci|le mois dernier)/,
    /(qu'est-ce qui s'est passé|quoi de neuf|résumé (?:de|du) (?:hier|la semaine|le mois))/,
  ];
  for (const p of datePatterns) {
    if (p.test(t)) return { type: 'date', query: t };
  }

  const personPatterns = [
    /(qu'est-ce que|que.*dit|que.*disait|parle.*de)\s+@?\w+/i,
    /(message.*de|ce que.*a dit|propos.*de)\s+@?\w+/i,
  ];
  for (const p of personPatterns) {
    if (p.test(t)) return { type: 'person', query: t };
  }

  return null;
}

async function _searchEpisodes(query, senderJid, jid) {
  try {
    const episodes = semanticMemory.episodes.getTimeline(300);
    const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const stopWords = new Set(['comment', 'pourquoi', 'est-ce', 'parce', 'aussi', 'entre', 'toujours', 'jamais', 'donc', 'mais', 'alors', 'enfin', 'voila', 'voici', 'sujet', 'chose', 'gens', 'faire', 'aller', 'voir', 'sais', 'peux', 'veux', 'dois', 'vais', 'fait', 'cette', 'leurs', 'notre', 'avec', 'sans', 'dans', 'chez', 'tout', 'plus', 'moins', 'tres', 'bien', 'assez', 'peut', 'être', 'avoir', 'avait', 'étais', 'était', 'été', 'déjà', 'avant', 'après', 'depuis']);
    const filtered = terms.filter(w => !stopWords.has(w)).slice(0, 8);
    if (filtered.length < 2) return [];

    const scored = [];
    for (const ep of episodes) {
      if (!ep.title && !ep.description) continue;
      const title = ((ep.title || '') + ' ' + (ep.description || '')).toLowerCase();
      const matchCount = filtered.filter(t => title.includes(t)).length;
      if (matchCount >= 2) {
        scored.push({ ...ep, score: matchCount / filtered.length });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  } catch {
    return [];
  }
}

async function _searchConversations(query, senderJid, jid) {
  try {
    const { getDB } = await import('../../infrastructure/database/database.js');
    const db = getDB();
    const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    if (terms.length < 2) return [];
    const likeClauses = terms.map(() => `content LIKE ?`).join(' AND ');
    const params = terms.map(t => `%${t}%`);
    const limit = 5;
    const rows = await db.all(
      `SELECT role, content, created_at FROM conversations WHERE jid = ? AND ${likeClauses} ORDER BY created_at DESC LIMIT ?`,
      jid || senderJid, ...params, limit
    );
    return rows.map(r => ({ title: r.content?.slice(0, 80), description: r.content, source: r.role, created_at: r.created_at }));
  } catch {
    return [];
  }
}

async function _searchByDate(query, senderJid, jid) {
  try {
    const now = Date.now();
    let since = now - 86400000;
    if (/cette semaine/i.test(query)) since = now - 7 * 86400000;
    else if (/la semaine dernière/i.test(query)) since = now - 14 * 86400000;
    else if (/ce mois-ci/i.test(query)) since = now - 30 * 86400000;
    else if (/le mois dernier/i.test(query)) since = now - 60 * 86400000;

    const episodes = semanticMemory.episodes.getTimeline(500);
    const filtered = episodes.filter(e => e.created_at > since && e.created_at < now);
    filtered.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    if (filtered.length === 0) return [];

    const topics = new Map();
    for (const ep of filtered) {
      const key = ep.title || 'sans titre';
      topics.set(key, (topics.get(key) || 0) + 1);
    }
    const topEntries = [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const period = /hier/i.test(query) ? 'hier' : /semaine/i.test(query) ? 'la semaine' : 'le mois';
    return [{
      id: 'date_summary',
      title: `Résumé de ${period}`,
      description: topEntries.map(([t, c]) => `• ${t} (${c}x)`).join('\n'),
      source: 'système',
      created_at: since,
      score: 1,
    }];
  } catch {
    return [];
  }
}

async function _searchByPerson(query, senderJid, jid) {
  try {
    const match = query.match(/@?(\w+)/i);
    if (!match) return [];
    const name = match[1].toLowerCase();

    const episodes = semanticMemory.episodes.getTimeline(500);
    const related = episodes.filter(e => {
      const src = (e.source || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return src.includes(name) || desc.includes(name);
    });
    related.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return related.slice(0, 3).map(r => ({ ...r, score: 1 }));
  } catch {
    return [];
  }
}

function _formatRecall(result, intent) {
  if (result.id === 'date_summary') {
    return `📅 *${result.title}*\n\n${result.description}`;
  }

  const daysAgo = clock.daysSince(result.created_at || 0);
  let timeStr = daysAgo <= 1 ? "aujourd'hui" : daysAgo <= 2 ? 'hier' : `il y a ${daysAgo}j`;
  const sourceName = result.source ? result.source.split('@')[0] : 'inconnu';
  const title = result.title || 'Sans titre';
  const desc = result.description ? `\n${result.description.slice(0, 200)}` : '';

  return `💡 *Rappel mémoire*\n📌 "${title}"${desc ? '\n   ' + desc : ''}\n👤 ${sourceName} · ${timeStr}`;
}

export { _detectRecallIntent, _searchEpisodes, _searchConversations };
