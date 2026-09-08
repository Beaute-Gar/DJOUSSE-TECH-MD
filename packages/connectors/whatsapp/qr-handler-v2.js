/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  qr-handler-v2.js — Gestion de QR multi-utilisateur       ║
 * ║  Chaque connexion WhatsApp génère son propre QR            ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { createLogger } from '../../infrastructure/logger.js';
import { SESSION_EVENTS } from '../../infrastructure/session/session-manager-v2.js';

const log = createLogger('QR-HANDLER-V2');

class QRHandlerV2 {
  constructor() {
    this.qrsEnAttente = new Map();
    this._initialise = false;
  }

  init() {
    if (this._initialise) return;

    SESSION_EVENTS.on('qr:available', ({ sessionId, qrCode, expiresAt }) => {
      this.qrsEnAttente.set(sessionId, {
        qrCode,
        expiresAt,
        createdAt: Date.now(),
        affiche: false,
      });
      log.info(`QR stocké pour session ${sessionId} (expire dans ${Math.round((expiresAt - Date.now()) / 1000)}s)`);
    });

    SESSION_EVENTS.on('session:connected', ({ sessionId }) => {
      this.qrsEnAttente.delete(sessionId);
    });

    SESSION_EVENTS.on('session:disconnected', ({ sessionId }) => {
      this.qrsEnAttente.delete(sessionId);
      log.info(`QR purgé pour session ${sessionId}`);
    });

    this._initialise = true;

    // Nettoyage périodique des QR expirés
    setInterval(() => this._nettoyer(), 30000);
  }

  getQR(sessionId) {
    const entry = this.qrsEnAttente.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.qrsEnAttente.delete(sessionId);
      return null;
    }
    entry.affiche = true;
    return entry.qrCode;
  }

  getQRBase64(sessionId) {
    const qr = this.getQR(sessionId);
    if (!qr) return null;
    return qr;
  }

  getTousLesQR() {
    const resultats = [];
    for (const [sessionId, entry] of this.qrsEnAttente) {
      if (entry.expiresAt > Date.now()) {
        resultats.push({
          sessionId,
          expireDans: Math.round((entry.expiresAt - Date.now()) / 1000),
        });
      }
    }
    return resultats;
  }

  estDisponible(sessionId) {
    return this.qrsEnAttente.has(sessionId) && this.qrsEnAttente.get(sessionId).expiresAt > Date.now();
  }

  async attendreQR(sessionId, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        SESSION_EVENTS.off(`session:${sessionId}:qr`, handlerQR);
        SESSION_EVENTS.off(`session:${sessionId}:connected`, handlerConnected);
        reject(new Error('Timeout en attente du QR'));
      }, timeoutMs);

      const handlerQR = (qrCode) => {
        clearTimeout(timeout);
        SESSION_EVENTS.off(`session:${sessionId}:connected`, handlerConnected);
        resolve(qrCode);
      };

      const handlerConnected = () => {
        clearTimeout(timeout);
        SESSION_EVENTS.off(`session:${sessionId}:qr`, handlerQR);
        resolve(null);
      };

      SESSION_EVENTS.once(`session:${sessionId}:qr`, handlerQR);
      SESSION_EVENTS.once(`session:${sessionId}:connected`, handlerConnected);

      const qrExistant = this.getQRBase64(sessionId);
      if (qrExistant) {
        clearTimeout(timeout);
        SESSION_EVENTS.off(`session:${sessionId}:qr`, handlerQR);
        SESSION_EVENTS.off(`session:${sessionId}:connected`, handlerConnected);
        resolve(qrExistant);
      }
    });
  }

  _nettoyer() {
    const maintenant = Date.now();
    let supprime = 0;
    for (const [sessionId, entry] of this.qrsEnAttente) {
      if (entry.expiresAt < maintenant) {
        this.qrsEnAttente.delete(sessionId);
        supprime++;
      }
    }
    if (supprime > 0) {
      log.debug(`${supprime} QR expirés nettoyés`);
    }
  }

  getStats() {
    return {
      enAttente: this.qrsEnAttente.size,
      actifs: Array.from(this.qrsEnAttente.values()).filter(e => e.expiresAt > Date.now()).length,
    };
  }
}

let instance = null;

export function getQRHandlerV2() {
  if (!instance) {
    instance = new QRHandlerV2();
    instance.init();
  }
  return instance;
}
