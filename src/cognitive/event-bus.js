import { createLogger } from '../core/logger.js';

const log = createLogger('EVENTBUS');

export const EVENTS = {
  MESSAGE_RECEIVED:     'message:received',
  MESSAGE_SENT:         'message:sent',
  IMAGE_RECEIVED:       'image:received',
  AUDIO_RECEIVED:       'audio:received',
  VIDEO_RECEIVED:       'video:received',
  DOCUMENT_RECEIVED:    'document:received',
  CONTACT_RECEIVED:     'contact:received',
  GROUP_JOIN:           'group:join',
  GROUP_LEAVE:          'group:leave',
  GROUP_PROMOTE:        'group:promote',
  GROUP_DEMOTE:         'group:demote',
  GROUP_UPDATE:         'group:update',
  CALL_RECEIVED:        'call:received',
  MESSAGE_DELETED:      'message:deleted',
  MESSAGE_REACTED:      'message:reacted',
  MESSAGE_EDITED:       'message:edited',
  GROUP_DESCRIPTION:    'group:description',
  GROUP_PHOTO:          'group:photo',
  GROUP_SETTINGS:       'group:settings',
  GROUP_INVITE:         'group:invite',
  PRESENCE_UPDATE:      'presence:update',
  HEARTBEAT:            'system:heartbeat',
  OBSERVER_OVERDUE:     'observer:overdue',
  OBSERVER_INACTIVE:    'observer:group_inactive',
  PERSON_IDENTIFIED:    'person:identified',
  PERSON_UPDATED:       'person:updated',
  PERSON_RELATED:       'person:related',
  PROJECT_DETECTED:     'project:detected',
  PROJECT_UPDATED:      'project:updated',
  COMPANY_DETECTED:     'company:detected',
  TASK_CREATED:         'task:created',
  TASK_COMPLETED:       'task:completed',
  INVOICE_DETECTED:     'invoice:detected',
  PAYMENT_DETECTED:     'payment:detected',
  EVENT_DETECTED:       'event:detected',
  DEADLINE_DETECTED:    'deadline:detected',
  DECISION_MADE:        'decision:made',
  KNOWLEDGE_ADDED:      'knowledge:added',
  KNOWLEDGE_RELATED:    'knowledge:related',
  MEMORY_STORED:        'memory:stored',
  MEMORY_RETRIEVED:     'memory:retrieved',
  LEARNING_UPDATED:     'learning:updated',
  PREDICTION_MADE:      'prediction:made',
  WORKFLOW_STARTED:     'workflow:started',
  WORKFLOW_COMPLETED:   'workflow:completed',
  ERROR:                'system:error',
  SHUTDOWN:             'system:shutdown',
  SCG_POLL_CREATED:     'scg:poll:created',
  SCG_POLL_VOTED:       'scg:poll:voted',
  SCG_POLL_CLOSED:      'scg:poll:closed',
  SCG_POLL_MANDATORY:   'scg:poll:mandatory',
  SCG_MODE_CHANGED:     'scg:mode:changed',
  SCG_GAME_STARTED:     'scg:game:started',
  SCG_GAME_ENDED:       'scg:game:ended',
  SCG_REWARD_AWARDED:   'scg:reward:awarded',
  SCG_MEMBER_LOCKED:    'scg:member:locked',
  SCG_MEMBER_UNLOCKED:  'scg:member:unlocked',
  SCG_SUMMARY_HOURLY:   'scg:summary:hourly',
  SCG_SUMMARY_DAILY:    'scg:summary:daily',
  SCG_PROFILE_UPDATED:  'scg:profile:updated',
};

class EventBus {
  #listeners = new Map();
  #history = [];
  #maxHistory = 100;

  on(event, fn, { once = false, priority = 0 } = {}) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once, priority });
    this.#listeners.get(event).sort((a, b) => b.priority - a.priority);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    return this.on(event, fn, { once: true });
  }

  off(event, fn) {
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    const idx = listeners.findIndex(l => l.fn === fn);
    if (idx !== -1) listeners.splice(idx, 1);
  }

  async emit(event, data = {}) {
    const listeners = this.#listeners.get(event) || [];
    this.#history.push({ event, data, timestamp: Date.now() });
    if (this.#history.length > this.#maxHistory) this.#history.shift();

    log.debug(`Event: ${event} (${listeners.length} listeners)`);

    const results = [];
    for (const listener of listeners) {
      try {
        const result = listener.fn(data, event);
        results.push(listener.once ? result : undefined);
        if (listener.once) this.off(event, listener.fn);
        if (result instanceof Promise) await result;
      } catch (err) {
        log.error(`[EventBus] ${event} listener: ${err.message}`);
        this.emit(EVENTS.ERROR, { event, error: err.message });
      }
    }
    return results;
  }

  emitSync(event, data = {}) {
    const listeners = this.#listeners.get(event) || [];
    this.#history.push({ event, data, timestamp: Date.now() });
    if (this.#history.length > this.#maxHistory) this.#history.shift();
    for (const listener of listeners) {
      try { listener.fn(data, event); } catch (err) {
        log.error(`[EventBus] ${event} sync: ${err.message}`);
      }
    }
  }

  getHistory(event) {
    return event ? this.#history.filter(h => h.event === event) : this.#history;
  }

  clear() {
    this.#listeners.clear();
    this.#history = [];
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.length || 0;
  }
}

export const bus = new EventBus();
export default bus;
