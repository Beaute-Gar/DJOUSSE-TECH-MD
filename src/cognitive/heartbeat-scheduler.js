import { createLogger } from '../core/logger.js';
import { bus } from './event-bus.js';
import { clock } from './cognitive-clock.js';

const log = createLogger('HEARTBEAT');

const FREQUENCIES = [
  { name: 'FAST',     interval: 5 * clock.MS.SECOND, event: 'heartbeat:fast' },
  { name: 'MINUTE',   interval: 1 * clock.MS.MINUTE, event: 'heartbeat:minute' },
  { name: 'FIVE_MIN', interval: 5 * clock.MS.MINUTE, event: 'heartbeat:five_minutes' },
  { name: 'HOUR',     interval: 1 * clock.MS.HOUR,   event: 'heartbeat:hour' },
  { name: 'DAY',      interval: 1 * clock.MS.DAY,    event: 'heartbeat:day' },
];

class HeartbeatScheduler {
  constructor() {
    this._timers = [];
    this._running = false;
    this._beats = {};
  }

  start() {
    if (this._running) return;
    this._running = true;

    const now = clock.now();
    for (const freq of FREQUENCIES) {
      this._beats[freq.name] = { lastBeat: now, count: 0 };
      this._timers.push(setInterval(() => this._pulse(freq), freq.interval));
    }

    bus.emit('heartbeat:started', { timestamp: now });
    log.info(`[HEARTBEAT] Scheduler started — ${FREQUENCIES.length} frequencies`);
  }

  stop() {
    this._running = false;
    for (const t of this._timers) clearInterval(t);
    this._timers = [];
    log.info('[HEARTBEAT] Scheduler stopped');
  }

  _pulse(freq) {
    const beat = this._beats[freq.name];
    beat.count++;
    beat.lastBeat = clock.now();

    bus.emit(freq.event, {
      timestamp: clock.now(),
      uptime: clock.uptime(),
      count: beat.count,
      interval: freq.interval,
    });
  }

  getStats() {
    return Object.fromEntries(
      Object.entries(this._beats).map(([name, b]) => [
        name,
        { ...b, lastBeatAgo: clock.minutesSince(b.lastBeat) + 'min' },
      ])
    );
  }
}

export const heartbeat = new HeartbeatScheduler();
export default heartbeat;
