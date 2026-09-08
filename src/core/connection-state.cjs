/**
 * Connection State Machine — DJOUSSE-TECH-MD
 * 
 * États réels de connexion WhatsApp, trackés depuis les événements Baileys.
 * États: CONNECTED | CONNECTING | DISCONNECTED | RECONNECTING | AUTHENTICATION_REQUIRED | ERROR
 */

const EventEmitter = require('events');

const STATES = {
  CONNECTED: 'CONNECTED',
  CONNECTING: 'CONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  ERROR: 'ERROR',
};

const STATE_LABELS = {
  CONNECTED: '✅ Connecté',
  CONNECTING: '🔄 Connexion en cours...',
  DISCONNECTED: '🔴 Déconnecté',
  RECONNECTING: '🔄 Reconnexion...',
  AUTHENTICATION_REQUIRED: '🔐 Session expirée — scan QR requis',
  ERROR: '❌ Erreur de connexion',
};

class ConnectionStateMachine extends EventEmitter {
  constructor() {
    super();
    this.state = STATES.DISCONNECTED;
    this.previousState = null;
    this.connectedAt = null;
    this.disconnectedAt = null;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.sessionOwner = null;
    this.botNumber = null;
    this.engine = null;
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnections: 0,
      uptime: 0,
      lastActivity: null,
    };
    this._uptimeStart = null;
  }

  /**
   * Mettre à jour l'état depuis un événement Baileys connection.update
   */
  handleConnectionUpdate(connection, lastDisconnect, qr) {
    if (connection === 'open') {
      this.setState(STATES.CONNECTED);
      this.connectedAt = Date.now();
      this._uptimeStart = Date.now();
      this.reconnectAttempts = 0;
      this.lastError = null;
      this.stats.totalConnections++;
    } else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      
      if (code === 401 || code === 403) {
        this.setState(STATES.AUTHENTICATION_REQUIRED);
        this.lastError = `Session invalide (code ${code})`;
      } else if (code === 408 || code === 503 || code === 515 || code === 516) {
        this.reconnectAttempts++;
        this.setState(STATES.RECONNECTING);
        this.lastError = `Déconnexion (code ${code}) — reconnexion #${this.reconnectAttempts}`;
        this.stats.totalReconnections++;
      } else {
        this.setState(STATES.DISCONNECTED);
        this.lastError = `Déconnexion (code ${code})`;
      }
      
      this.disconnectedAt = Date.now();
      this.stats.totalDisconnections++;
      this._uptimeStart = null;
    } else if (qr) {
      this.setState(STATES.CONNECTING);
    }
  }

  /**
   * Mettre à jour l'état
   */
  setState(newState) {
    if (newState === this.state) return;
    this.previousState = this.state;
    this.state = newState;
    this.stats.lastActivity = Date.now();
    this.emit('stateChange', {
      state: newState,
      previousState: this.previousState,
      label: STATE_LABELS[newState],
      timestamp: Date.now(),
    });
  }

  /**
   * Obtenir l'état actuel
   */
  getState() {
    const uptime = this._uptimeStart ? Date.now() - this._uptimeStart : 0;
    return {
      state: this.state,
      label: STATE_LABELS[this.state],
      previousState: this.previousState,
      connected: this.state === STATES.CONNECTED,
      connectedAt: this.connectedAt,
      disconnectedAt: this.disconnectedAt,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      sessionOwner: this.sessionOwner,
      botNumber: this.botNumber,
      engine: this.engine,
      uptime,
      stats: { ...this.stats },
    };
  }

  /**
   * Obtenir les stats pour le dashboard
   */
  getDashboardData() {
    const s = this.getState();
    return {
      whatsapp: s.state,
      whatsappLabel: s.label,
      connected: s.connected,
      connectedAt: s.connectedAt,
      uptime: s.uptime,
      reconnectAttempts: s.reconnectAttempts,
      lastError: s.lastError,
      sessionOwner: s.sessionOwner,
      botNumber: s.botNumber,
      engine: s.engine,
      totalConnections: s.stats.totalConnections,
      totalDisconnections: s.stats.totalDisconnections,
      totalReconnections: s.stats.totalReconnections,
    };
  }
}

// Singleton
let instance = null;
function getConnectionState() {
  if (!instance) instance = new ConnectionStateMachine();
  return instance;
}

module.exports = { getConnectionState, STATES, STATE_LABELS };
