import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { clock } from './cognitive-clock.js';
import { semanticMemory } from './semantic-memory.js';

const log = createLogger('EPISODE');

const EPISODE_TYPES = {
  MESSAGE:        'message',
  GROUP_JOIN:     'group:join',
  GROUP_LEAVE:    'group:leave',
  GROUP_PROMOTE:  'group:promote',
  GROUP_DEMOTE:   'group:demote',
  GROUP_UPDATE:   'group:update',
  GROUP_DESC:     'group:description',
  MESSAGE_DELETE: 'message:delete',
  REACTION:       'reaction',
  CALL:           'call',
  DECISION:       'decision',
  PREDICTION:     'prediction',
  SYSTEM:         'system',
};

class EpisodeFactory {
  constructor() {
    this._episodeCount = 0;
  }

  createFromEvent(eventType, data) {
    const factory = this._mapping[eventType];
    if (!factory) return null;

    this._episodeCount++;
    const episode = factory(data);
    episode.id = `ep_${Date.now()}_${this._episodeCount}`;
    episode.observedAt = clock.now();
    episode.timelineLabel = clock.relativeLabel(clock.now());

    this._store(episode);
    return episode;
  }

  _mapping = {
    [EVENTS.MESSAGE_RECEIVED]: (d) => ({
      type: EPISODE_TYPES.MESSAGE,
      importance: d.text?.length > 200 ? 0.6 : d.text?.length > 50 ? 0.4 : 0.2,
      persons: [d.senderJid],
      group: d.isGroup ? d.jid : null,
      summary: (d.text || '').slice(0, 200),
      relations: d.isGroup ? [{ target: d.jid, type: 'sent_in' }] : [],
      source: d.senderJid,
    }),

    [EVENTS.GROUP_JOIN]: (d) => ({
      type: EPISODE_TYPES.GROUP_JOIN,
      importance: 0.5,
      persons: [d.participantJid],
      group: d.groupJid,
      summary: `${d.participantJid} a rejoint ${d.groupJid}`,
      relations: [
        { target: d.groupJid, type: 'joined' },
        { target: d.participantJid, type: 'involves' },
      ],
    }),

    [EVENTS.GROUP_LEAVE]: (d) => ({
      type: EPISODE_TYPES.GROUP_LEAVE,
      importance: 0.4,
      persons: [d.participantJid],
      group: d.groupJid,
      summary: `${d.participantJid} a quitté ${d.groupJid}`,
      relations: [
        { target: d.groupJid, type: 'left' },
        { target: d.participantJid, type: 'involves' },
      ],
    }),

    [EVENTS.GROUP_PROMOTE]: (d) => ({
      type: EPISODE_TYPES.GROUP_PROMOTE,
      importance: 0.6,
      persons: [d.participantJid],
      group: d.groupJid,
      summary: `${d.participantJid} promu admin dans ${d.groupJid}`,
      relations: [{ target: d.participantJid, type: 'promoted_in', targetType: d.groupJid }],
    }),

    [EVENTS.GROUP_DEMOTE]: (d) => ({
      type: EPISODE_TYPES.GROUP_DEMOTE,
      importance: 0.5,
      persons: [d.participantJid],
      group: d.groupJid,
      summary: `${d.participantJid} rétrogradé dans ${d.groupJid}`,
      relations: [{ target: d.participantJid, type: 'demoted_in', targetType: d.groupJid }],
    }),

    [EVENTS.GROUP_UPDATE]: (d) => ({
      type: EPISODE_TYPES.GROUP_UPDATE,
      importance: 0.3,
      group: d.groupJid,
      summary: `Groupe mis à jour: ${d.subject || 'changement'}`,
      relations: [],
    }),

    [EVENTS.GROUP_DESCRIPTION]: (d) => ({
      type: EPISODE_TYPES.GROUP_DESC,
      importance: d.description?.length > 50 ? 0.5 : 0.3,
      group: d.groupJid,
      persons: d.author ? [d.author] : [],
      summary: `Description mise à jour: ${(d.description || '').slice(0, 100)}`,
      relations: [],
    }),

    [EVENTS.MESSAGE_DELETED]: (d) => ({
      type: EPISODE_TYPES.MESSAGE_DELETE,
      importance: 0.2,
      persons: d.author ? [d.author] : [],
      group: d.jid?.endsWith('@g.us') ? d.jid : null,
      summary: 'Message supprimé',
      relations: [],
    }),

    [EVENTS.MESSAGE_REACTED]: (d) => ({
      type: EPISODE_TYPES.REACTION,
      importance: 0.1,
      persons: [d.senderJid],
      summary: `Réaction: ${d.reaction || ''}`,
      relations: [],
    }),

    [EVENTS.CALL_RECEIVED]: (d) => ({
      type: EPISODE_TYPES.CALL,
      importance: d.status === 'offer' ? 0.4 : 0.2,
      persons: d.from ? [d.from] : [],
      summary: `Appel ${d.status || 'reçu'}`,
      relations: [],
    }),
  };

  _store(episode) {
    try {
      if (semanticMemory?.episodes?.store) {
        semanticMemory.episodes.store(episode);
      }
      bus.emit('episode:created', { episode, timestamp: clock.now() });
    } catch (err) {
      log.warn(`[EPISODE] store error: ${err.message}`);
    }
  }

  getStats() {
    return { total: this._episodeCount };
  }
}

export const episodeFactory = new EpisodeFactory();
export { EPISODE_TYPES };
export default episodeFactory;
