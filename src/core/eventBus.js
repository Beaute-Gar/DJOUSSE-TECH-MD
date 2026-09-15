/**
 * EventBus — Système d'événements centralisé pour DJOUSSE TECH
 * Tous les modules communiquent via cet bus
 */

const EventEmitter = require('events');

class DJEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistory = 500;
  }

  emit(event, data = {}) {
    const entry = {
      event,
      data,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
    };
    this.eventHistory.push(entry);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
    super.emit(event, entry);
    super.emit('*', entry);
  }

  getHistory(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  getHistoryByType(type, limit = 20) {
    return this.eventHistory
      .filter(e => e.event.startsWith(type))
      .slice(-limit);
  }

  clearHistory() {
    this.eventHistory = [];
  }
}

const bus = new DJEventBus();
module.exports = bus;
