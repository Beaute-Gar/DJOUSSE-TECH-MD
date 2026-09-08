import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('DATA-VALIDATOR');

export class DataValidator {
  constructor(sock) {
    this.sock = sock;
  }

  async verifierConnexion() {
    try {
      const state = this.sock?.user ? 'open' : 'closed';
      return {
        estConnecte: state === 'open',
        details: state,
        timestamp: new Date().toISOString(),
        phoneNumber: this.sock?.user?.id || null,
        deviceName: this.sock?.user?.name || null
      };
    } catch (error) {
      return { estConnecte: false, erreur: error.message, timestamp: new Date().toISOString() };
    }
  }

  async verifierGroupes() {
    try {
      if (!this.sock?.user) return { count: 0, groupes: [], erreur: 'Non connecté' };
      const raw = await this.sock.groupFetchAllParticipating().catch(() => ({}));
      const groupes = Object.values(raw || {});
      return {
        count: groupes.length,
        groupes: groupes.slice(0, 5).map(g => ({ id: g.id, nom: g.subject, participants: g.participants?.length || 0 })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { count: 0, groupes: [], erreur: error.message };
    }
  }

  async verifierContacts() {
    try {
      if (!this.sock?.user) return { count: 0, contacts: [], erreur: 'Non connecté' };
      const contacts = await this.sock.getContacts().catch(() => []);
      return {
        count: contacts.length,
        contacts: contacts.slice(0, 5).map(c => ({ id: c.id, nom: c.name || c.pushname || 'Inconnu' })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { count: 0, contacts: [], erreur: error.message };
    }
  }

  async verifierMessages() {
    try {
      const { getDB } = await import('../../packages/infrastructure/database/database.js');
      const db = getDB();
      if (!db) return { total: 0, aujourdhui: 0, ok: false };
      const total = parseInt((await db.get("SELECT COUNT(*) as c FROM messages").catch(() => ({ c: 0 })))?.c || 0);
      const aujourdhui = parseInt((await db.get("SELECT COUNT(*) as c FROM messages WHERE date(dateEnvoi) = date('now')").catch(() => ({ c: 0 })))?.c || 0);
      return { total, aujourdhui, ok: true, timestamp: new Date().toISOString() };
    } catch (error) {
      return { total: 0, aujourdhui: 0, ok: false, erreur: error.message };
    }
  }

  async verifierPerformance() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      ok: true,
      timestamp: new Date().toISOString()
    };
  }

  async diagnostiquerComplet() {
    const [connexion, groupes, contacts, messages, performance] = await Promise.all([
      this.verifierConnexion(),
      this.verifierGroupes(),
      this.verifierContacts(),
      this.verifierMessages(),
      this.verifierPerformance()
    ]);
    return {
      connexion,
      groupes,
      contacts,
      messages,
      performance,
      timestamp: new Date().toISOString(),
      ok: connexion.estConnecte && groupes.count > 0 && messages.ok
    };
  }
}

export function createValidator(sock) {
  return new DataValidator(sock);
}
