/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  user-space.js — Espace personnel isolé par utilisateur    ║
 * ║  User A ≠ User B — Aucune donnée ne doit être mélangée     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { getDB } from '../database/database.js';
import { createLogger } from '../logger.js';
import crypto from 'crypto';

const log = createLogger('USER-SPACE');

const ESPACES_CACHE = new Map();

export class UserSpace {
  constructor(userId) {
    this.userId = userId;
    this._data = null;
  }

  static async creer(userId, options = {}) {
    const db = getDB();
    const maintenant = Date.now();

    const encryptionKey = options.encryptionKey || crypto.randomBytes(32).toString('hex');
    const encryptionIv = options.encryptionIv || crypto.randomBytes(16).toString('hex');

    await db.run(
      `INSERT INTO user_spaces (user_id, whatsapp_number, owner_name, status, created_at, updated_at, encryption_key, encryption_iv)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at`,
      [userId, options.whatsappNumber || null, options.ownerName || null, maintenant, maintenant, encryptionKey, encryptionIv]
    );

    const espace = new UserSpace(userId);
    ESPACES_CACHE.set(userId, espace);
    log.info(`Espace utilisateur créé : ${userId}`);
    return espace;
  }

  static async get(userId) {
    if (ESPACES_CACHE.has(userId)) return ESPACES_CACHE.get(userId);

    const db = getDB();
    const row = await db.get(`SELECT * FROM user_spaces WHERE user_id = ?`, [userId]);
    if (!row) return null;

    const espace = new UserSpace(userId);
    espace._data = row;
    ESPACES_CACHE.set(userId, espace);
    return espace;
  }

  static async getOuCreer(userId, options = {}) {
    const existant = await UserSpace.get(userId);
    if (existant) return existant;
    return UserSpace.creer(userId, options);
  }

  async existe() {
    if (this._data) return true;
    const db = getDB();
    const row = await db.get(`SELECT 1 FROM user_spaces WHERE user_id = ?`, [this.userId]);
    return !!row;
  }

  async charger() {
    const db = getDB();
    this._data = await db.get(`SELECT * FROM user_spaces WHERE user_id = ?`, [this.userId]);
    return this._data;
  }

  async mettreAJour(champs) {
    const db = getDB();
    champs.updated_at = Date.now();
    const sets = Object.keys(champs).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(champs);
    await db.run(`UPDATE user_spaces SET ${sets} WHERE user_id = ?`, [...vals, this.userId]);
    ESPACES_CACHE.delete(this.userId);
  }

  async supprimer() {
    const db = getDB();
    await db.run(`DELETE FROM user_spaces WHERE user_id = ?`, [this.userId]);
    ESPACES_CACHE.delete(this.userId);
    log.warn(`Espace utilisateur supprimé : ${this.userId}`);
  }

  get donnees() {
    return this._data;
  }

  // ── Préférences par groupe ──────────────────────────────

  async getPrefsGroupe(groupJid) {
    const db = getDB();
    return db.get(
      `SELECT * FROM per_group_prefs WHERE user_id = ? AND group_jid = ?`,
      [this.userId, groupJid]
    );
  }

  async setPrefsGroupe(groupJid, prefs) {
    const db = getDB();
    const maintenant = Date.now();
    const existantes = await this.getPrefsGroupe(groupJid);

    if (existantes) {
      const sets = Object.keys(prefs).map(k => `${k} = ?`).join(', ');
      const vals = Object.values(prefs);
      await db.run(
        `UPDATE per_group_prefs SET ${sets}, updated_at = ? WHERE user_id = ? AND group_jid = ?`,
        [...vals, maintenant, this.userId, groupJid]
      );
    } else {
      await db.run(
        `INSERT INTO per_group_prefs (user_id, group_jid, ainoria_mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [this.userId, groupJid, prefs.ainoria_mode || 'off', maintenant, maintenant]
      );
    }
  }

  async listerTousLesGroupes() {
    const db = getDB();
    return db.all(
      `SELECT * FROM per_group_prefs WHERE user_id = ? ORDER BY group_name ASC`,
      [this.userId]
    );
  }

  // ── Mémoire isolée ──────────────────────────────────────

  async ajouterMemoire(type, content, options = {}) {
    const db = getDB();
    const maintenant = Date.now();
    return db.run(
      `INSERT INTO user_memory (user_id, memory_type, content, source, confidence, is_private, created_at, last_accessed_at, ttl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.userId, type, content, options.source || null, options.confidence || 1.0, options.isPrivate !== false ? 1 : 0, maintenant, maintenant, options.ttl || null]
    );
  }

  async rechercherMemoire(type, limite = 20) {
    const db = getDB();
    const rows = await db.all(
      `SELECT * FROM user_memory WHERE user_id = ? AND memory_type = ? ORDER BY created_at DESC LIMIT ?`,
      [this.userId, type, limite]
    );
    await db.run(
      `UPDATE user_memory SET last_accessed_at = ? WHERE user_id = ? AND memory_type = ?`,
      [Date.now(), this.userId, type]
    );
    return rows;
  }

  async supprimerMemoire(memoryId) {
    const db = getDB();
    return db.run(`DELETE FROM user_memory WHERE id = ? AND user_id = ?`, [memoryId, this.userId]);
  }

  async viderMemoire() {
    const db = getDB();
    return db.run(`DELETE FROM user_memory WHERE user_id = ?`, [this.userId]);
  }

  // ── Journal d'audit ─────────────────────────────────────

  async ajouterAudit(action, details = {}) {
    const db = getDB();
    return db.run(
      `INSERT INTO user_audit_log (user_id, action, resource, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [this.userId, action, details.resource || null, JSON.stringify(details), details.status || 'success', Date.now()]
    );
  }

  async getAuditLog(limite = 50) {
    const db = getDB();
    return db.all(
      `SELECT * FROM user_audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [this.userId, limite]
    );
  }

  // ── Intégrations ───────────────────────────────────────

  async enregistrerIntegration(service, config = {}, credentials = {}) {
    const db = getDB();
    const maintenant = Date.now();
    return db.run(
      `INSERT INTO user_integrations (user_id, service, config, credentials, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(user_id, service) DO UPDATE SET config = ?, credentials = ?, updated_at = ?`,
      [this.userId, service, JSON.stringify(config), JSON.stringify(credentials), maintenant, maintenant,
       JSON.stringify(config), JSON.stringify(credentials), maintenant]
    );
  }

  async getIntegration(service) {
    const db = getDB();
    return db.get(
      `SELECT * FROM user_integrations WHERE user_id = ? AND service = ?`,
      [this.userId, service]
    );
  }

  async listerIntegrations() {
    const db = getDB();
    return db.all(
      `SELECT * FROM user_integrations WHERE user_id = ? ORDER BY service ASC`,
      [this.userId]
    );
  }
}

let cacheInstance = null;

export function getUserSpace(userId) {
  return UserSpace.getOuCreer(userId);
}

export async function initialiserUserSpaces() {
  log.info('User Space Manager prêt — isolation complète active');
}
