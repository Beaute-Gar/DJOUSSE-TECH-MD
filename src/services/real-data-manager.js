import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('REAL-DATA-MGR');

export class RealTimeDataManager {
  constructor(sock, db) {
    this.sock = sock;
    this.db = db;
    this.cache = {
      groupes: null,
      contacts: null,
      connexion: null,
      stats: null,
      activite: [],
      lastUpdate: null
    };
    this.updateInterval = 120000;
    this._timer = null;
    this._refreshing = false;
    this._listeners = [];
    this._msgCount = 0;
    this._msgFlushTimer = null;
    this._syncPending = 0;
    this._syncDebounce = null;
    this._consecutiveFailures = 0;
  }

  async init() {
    await this._ensureTables();
    this._setupListeners();
    await this.refreshAll();
    this._scheduleNext();
    this._msgFlushTimer = setInterval(() => this._flushMsgCount(), 60000);
    log.info('RealTimeDataManager initialisé');
  }

  async _ensureTables() {
    try {
      const { createAllTables } = await import('../db/create-tables.js');
      await createAllTables();
    } catch (e) {
      log.warn(`createAllTables: ${e.message}`);
    }
  }

  async _getDB() {
    if (this.db) return this.db;
    const { getDB } = await import('../../packages/infrastructure/database/database.js');
    this.db = getDB();
    return this.db;
  }

  _setupListeners() {
    if (!this.sock) return;
    if (this.sock.ev) {
      this.sock.ev.on('groups.update', async (updates) => {
        this._scheduleSync(() => this._syncGroupes(updates));
      });
      this.sock.ev.on('contacts.update', async (updates) => {
        this._scheduleSync(() => this._syncContacts(updates));
      });
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m?.messages?.length) this._msgCount += m.messages.length;
      });
    }
  }

  _scheduleSync(fn) {
    this._syncPending++;
    if (this._syncDebounce) clearTimeout(this._syncDebounce);
    this._syncDebounce = setTimeout(() => {
      this._syncPending = 0;
      fn().catch((e) => log.warn(`Sync différé: ${e.message}`));
    }, 5000);
  }

  async _syncGroupes(updates) {
    const db = await this._getDB();
    if (!db) return;
    for (const g of updates || []) {
      const now = new Date().toISOString();
      const creationEpoch = Number(g.creation || g.createdAt || 0);
      let creationIso = null;
      if (creationEpoch > 0) {
        try {
          const d = creationEpoch > 1e12 ? new Date(creationEpoch) : new Date(creationEpoch * 1000);
          creationIso = d.toISOString();
        } catch { creationIso = null; }
      }
      try {
        await db.run(
          `INSERT INTO groupes_reels (id, nom, description, createur, participants, dateCreation, derniereActivite, messagesTotal, estActif, synchroDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET nom=?, description=?, participants=?, derniereActivite=?, synchroDate=?`,
          g.id, g.subject || g.name || 'Sans nom', g.desc || '', g.owner || '',
          JSON.stringify(g.participants || []), creationIso || now, now, 0, now,
          g.subject || g.name || 'Sans nom', g.desc || '',
          JSON.stringify(g.participants || []), now, now
        );
      } catch (e) { log.warn(`Sync groupe: ${e.message}`); }
    }
  }

  async _syncContacts(updates) {
    const db = await this._getDB();
    if (!db) return;
    /* Limiter à 50 contacts max par batch pour éviter I/O error SQLite */
    const batch = (updates || []).slice(0, 50);
    for (const c of batch) {
      const now = new Date().toISOString();
      try {
        await db.run(
          `INSERT OR REPLACE INTO contacts_reels (id, nom, numero, photoUrl, presence, dernierMessage, messagesEchanges, estBloque, estArchive, labels, synchroDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          c.id, c.name || c.pushname || c.verifiedName || 'Inconnu', c.id?.split('@')[0] || '',
          c.profilePictureUrl || null, c.presence || 'unknown', c.lastMessage || null,
          c.messageCount || 0, c.isBlocked ? 1 : 0, c.isArchived ? 1 : 0,
          JSON.stringify(c.labels || []), now
        );
      } catch (e) { log.warn(`Sync contact: ${e.message}`); }
    }
    if ((updates || []).length > 50) log.info(`Contacts batch limité: 50/${updates.length}`);
  }

  async _flushMsgCount() {
    if (!this._msgCount) return;
    const today = new Date().toISOString().split('T')[0];
    const n = this._msgCount;
    this._msgCount = 0;
    try {
      const db = await this._getDB();
      if (db) {
        const existing = await db.get('SELECT valeur FROM stats_temps_reel WHERE type = ? AND date(dateEnregistrement) = ?', 'messages_journalier', today).catch(() => null);
        if (existing) {
          await db.run('UPDATE stats_temps_reel SET valeur = CAST(CAST(valeur AS INTEGER) + ? AS TEXT) WHERE type = ? AND date(dateEnregistrement) = ?',
            n, 'messages_journalier', today).catch(() => {});
        } else {
          await db.run('INSERT INTO stats_temps_reel (type, valeur, dateEnregistrement) VALUES (?, ?, datetime(\'now\'))',
            'messages_journalier', String(n)).catch(() => {});
        }
      }
    } catch {}
  }

  _scheduleNext() {
    this._timer = setTimeout(() => this.refreshAll(), this.updateInterval);
  }

  async refreshAll() {
    if (this._refreshing) return;
    this._refreshing = true;
    try {
      const db = await this._getDB();
      if (this.sock?.user) {
        if (this.sock.groupFetchAllParticipating) {
          const raw = await this.sock.groupFetchAllParticipating().catch(() => ({}));
          this.cache.groupes = Object.values(raw || {});
          const updates = Object.values(raw || {});
          if (updates.length) this._scheduleSync(() => this._syncGroupes(updates));
        }
        if (this.sock.getContacts) {
          const all = await this.sock.getContacts().catch(() => []);
          this.cache.contacts = (all || []).slice(0, 200);
        }
      }
      this.cache.connexion = {
        status: this.sock?.user ? 'connected' : 'disconnected',
        phoneNumber: this.sock?.user?.id || 'Non connecté',
        deviceName: this.sock?.user?.name || 'Inconnu',
        platform: this.sock?.user?.platform || 'Inconnue'
      };
      this.cache.stats = this._calculerStats();
      this.cache.lastUpdate = new Date().toISOString();
      this._consecutiveFailures = 0;
      this.updateInterval = 120000;
      log.info('Données rafraîchies');
      return this.cache;
    } catch (error) {
      this._consecutiveFailures++;
      this.updateInterval = Math.min(120000 * Math.pow(2, this._consecutiveFailures), 600000);
      log.error(`Erreur refresh (retry dans ${Math.round(this.updateInterval / 1000)}s): ${error.message}`);
      return this.cache;
    } finally {
      this._refreshing = false;
      this._scheduleNext();
    }
  }

  _calculerStats() {
    const stats = { totalGroupes: 0, totalContacts: 0, messagesAujourdhui: this._msgCount, messagesTotal: 0, groupesActifs: 0, demandesEnAttente: 0 };
    if (this.cache.groupes) {
      stats.totalGroupes = this.cache.groupes.length;
      stats.groupesActifs = this.cache.groupes.filter(g => g.participants?.length > 0).length;
    }
    if (this.cache.contacts) stats.totalContacts = this.cache.contacts.length;
    stats.messagesTotal = this._msgCount;
    return stats;
  }

  getGroupes() {
    return this.cache.groupes || [];
  }

  getContacts() {
    return this.cache.contacts || [];
  }

  getConnexion() {
    return this.cache.connexion || { status: 'disconnected', phoneNumber: 'Non connecté', deviceName: 'Inconnu', platform: 'Inconnue' };
  }

  getStats() {
    return this.cache.stats || { totalGroupes: 0, totalContacts: 0, messagesAujourdhui: 0, messagesTotal: 0, groupesActifs: 0, demandesEnAttente: 0 };
  }

  stop() {
    if (this._timer) clearTimeout(this._timer);
    if (this._msgFlushTimer) clearInterval(this._msgFlushTimer);
    if (this._syncDebounce) clearTimeout(this._syncDebounce);
    log.info('RealTimeDataManager arrêté');
  }
}

let _instance = null;
export function getDataManager(sock, db) {
  if (!_instance) _instance = new RealTimeDataManager(sock, db);
  return _instance;
}
