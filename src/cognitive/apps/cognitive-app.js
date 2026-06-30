import { createLogger } from '../../core/logger.js';
import { api } from '../cognitive-api.js';
import { bus, EVENTS } from '../event-bus.js';

const log = createLogger('APP');

export class CognitiveApp {
  constructor(config) {
    this.name = config.name || this.constructor.name;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this._ready = false;
    log.info(`[App:${this.name}] Initialise`);
  }

  get ready() { return this._ready; }

  async observe(input, options) { return api.observe(input, options); }
  async reason(context, options) { return api.reason(context, options); }
  async plan(goal, options) { return api.plan(goal, options); }
  async predict(query, options) { return api.predict(query, options); }
  async remember(query, options) { return api.remember(query, options); }
  async search(query, options) { return api.search(query, options); }
  async act(action, options) { return api.act(action, options); }

  render() { return { app: this.name, version: this.version, status: this._ready ? 'active' : 'initializing' }; }

  async start() { this._ready = true; bus.emit('app:started', { name: this.name }); log.info(`[App:${this.name}] Demarre`); return this; }
  async stop() { this._ready = false; bus.emit('app:stopped', { name: this.name }); log.info(`[App:${this.name}] Arrete`); return this; }

  on(event, handler) { return bus.on(event, handler); }
  emit(event, data) { bus.emit(event, { app: this.name, ...data }); }
}

export default CognitiveApp;
