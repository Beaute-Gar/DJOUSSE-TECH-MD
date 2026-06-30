import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { pipeline } from './cognitive-pipeline.js';
import { episodeFactory } from './episode-factory.js';
import { clock } from './cognitive-clock.js';

const log = createLogger('OBSERVER');

class ObserverLoop {
  constructor() {
    this._unsubscribers = [];
    this._stats = { eventsObserved: 0, episodesCreated: 0, errors: 0 };
  }

  start() {
    log.info('[OBSERVER] Starting — observing all WhatsApp events');

    this._subscribe(EVENTS.MESSAGE_RECEIVED, this._observe);
    this._subscribe(EVENTS.GROUP_JOIN, this._observe);
    this._subscribe(EVENTS.GROUP_LEAVE, this._observe);
    this._subscribe(EVENTS.GROUP_PROMOTE, this._observe);
    this._subscribe(EVENTS.GROUP_DEMOTE, this._observe);
    this._subscribe(EVENTS.GROUP_UPDATE, this._observe);
    this._subscribe(EVENTS.GROUP_DESCRIPTION, this._observe);
    this._subscribe(EVENTS.MESSAGE_DELETED, this._observe);
    this._subscribe(EVENTS.MESSAGE_REACTED, this._observe);
    this._subscribe(EVENTS.CALL_RECEIVED, this._observe);

    this._subscribe('heartbeat:fast', this._onHeartbeatFast);
    this._subscribe('heartbeat:minute', this._onHeartbeatMinute);
    this._subscribe('heartbeat:hour', this._onHeartbeatHour);
    this._subscribe('heartbeat:day', this._onHeartbeatDay);

    bus.emit('observer:ready', { timestamp: clock.now() });
    log.info('[OBSERVER] Watching all events — dispatching to cognitive pipeline');
  }

  stop() {
    for (const unsub of this._unsubscribers) unsub();
    this._unsubscribers = [];
    log.info('[OBSERVER] Stopped');
  }

  _subscribe(event, handler) {
    const unsub = bus.on(event, async (data) => {
      this._stats.eventsObserved++;
      try {
        await handler.call(this, data, event);
      } catch (err) {
        this._stats.errors++;
        log.error(`[OBSERVER] ${event}: ${err.message}`);
      }
    }, { priority: 50 });
    this._unsubscribers.push(unsub);
  }

  async _observe(data, eventType) {
    const episode = episodeFactory.createFromEvent(eventType, data);
    if (!episode) return;

    this._stats.episodesCreated++;

    const enriched = { ...data, episode, observedAt: clock.now() };
    await pipeline.dispatch(eventType, enriched);
  }

  async _onHeartbeatFast(data) {
    await pipeline.dispatch('heartbeat:fast', data);
  }

  async _onHeartbeatMinute(data) {
    await pipeline.dispatch('heartbeat:minute', data);
  }

  async _onHeartbeatHour(data) {
    await pipeline.dispatch('heartbeat:hour', data);
  }

  async _onHeartbeatDay(data) {
    await pipeline.dispatch('heartbeat:day', data);
  }

  getStats() {
    return { ...this._stats, uptime: clock.uptime() };
  }
}

export const observer = new ObserverLoop();
export default observer;
