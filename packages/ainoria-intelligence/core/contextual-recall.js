import { createLogger } from '../../infrastructure/logger.js';
import { EVENTS } from './event-bus.js';
import { executor, ACTION_TYPES } from '../actions/action-executor.js';
import { clock } from './cognitive-clock.js';
import { semanticMemory } from '../memory/semantic-memory.js';

const log = createLogger('CTX:RECALL');
const _recentRecall = new Map();

export function registerContextualRecall(pipeline) {
  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup } = data;
    if (!text || text.startsWith('.') || text.length < 30) return;

    const keyTerms = _extractKeyTerms(text);
    if (keyTerms.length < 2) return;

    try {
      const episodes = semanticMemory.episodes.getTimeline(200);
      const matches = [];

      for (const ep of episodes) {
        if (!ep.title || ep.source === senderJid) continue;
        const matchCount = keyTerms.filter(t => {
          const title = (ep.title || '').toLowerCase();
          const summary = (ep.summary || '').toLowerCase();
          return title.includes(t) || summary.includes(t);
        }).length;
        if (matchCount >= 2 && matchCount / keyTerms.length > 0.3) {
          matches.push({ episode: ep, score: matchCount / keyTerms.length });
        }
      }

      matches.sort((a, b) => b.score - a.score);
      if (matches.length === 0) return;

      const best = matches[0];
      if (best.score < 0.4) return;
      const recallKey = `${senderJid}:${best.episode.id}`;
      if (_recentRecall.has(recallKey) && clock.now() - _recentRecall.get(recallKey) < 86400000) return;
      _recentRecall.set(recallKey, clock.now());

      const daysAgo = clock.daysSince(best.episode.created_at || 0);
      let timeStr = daysAgo <= 1 ? 'hier' : `il y a ~${daysAgo}j`;
      const sourceName = best.episode.source ? best.episode.source.split('@')[0] : 'quelqu\'un';

      const recallMsg = `💡 *Rappel contextuel*\n📌 "${best.episode.title}"\n   évoqué par ${sourceName} ${timeStr}\n🔍 Pertinence : ${Math.round(best.score * 100)}%`;
      await executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid: senderJid, text: recallMsg },
        source: 'contextual-recall',
      });
    } catch (err) {
      log.warn(`[CTX:RECALL] ${err.message}`);
    }
  }, { priority: 5, description: 'contextual-recall' });
}

function _extractKeyTerms(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const stopWords = new Set(['comment', 'pourquoi', 'est-ce', 'parce', 'aussi', 'entre', 'toujours', 'jamais', 'donc', 'mais', 'alors', 'enfin', 'voila', 'voici', 'sujet', 'chose', 'gens', 'faire', 'aller', 'voir', 'sais', 'peux', 'veux', 'dois', 'vais', 'fait', 'cette', 'leurs', 'notre', 'avec', 'sans', 'dans', 'chez', 'tout', 'plus', 'moins', 'tres', 'bien', 'assez', 'peut', 'peux', 'être', 'avoir']);
  return words.filter(w => !stopWords.has(w)).slice(0, 10);
}
