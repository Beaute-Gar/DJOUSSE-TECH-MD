/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  permissions-store.js — Contrôle AINORIA par groupe       ║
 * ║  L'utilisateur garde toujours le contrôle                  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { getDB } from '../../infrastructure/database/database.js';
import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('PERM-STORE');

export const MODES_AINORIA = {
  OFF: 'off',
  SUGGESTIONS_ONLY: 'suggestions_only',
  AUTOMATIC: 'automatic',
  FULL: 'full',
};

export class PermissionsStore {
  constructor(userId) {
    this.userId = userId;
  }

  /**
   * Règle absolue : chaque activation doit être enregistrée.
   * Chaque action importante passe par :
   *   Utilisateur → AINORIA → Security Core → Policy Engine → Action autorisée
   */
  async verifier(groupeJid, action) {
    const prefs = await this._chargerPrefs(groupeJid);
    if (!prefs) return { autorise: false, raison: 'groupe_non_configuré', modeActuel: 'off' };

    if (prefs.ainoria_mode === 'off') {
      return { autorise: false, raison: 'ainoria_désactivé_pour_ce_groupe', modeActuel: 'off' };
    }

    if (prefs.ainoria_mode === 'suggestions_only' && action !== 'suggestion') {
      return { autorise: false, raison: 'mode_suggestions_seulement', modeActuel: 'suggestions_only' };
    }

    if (prefs.ainoria_mode === 'automatic' && action === 'full_assistance') {
      return { autorise: false, raison: 'mode_automatique_limité', modeActuel: 'automatic' };
    }

    return { autorise: true, raison: 'ok', modeActuel: prefs.ainoria_mode };
  }

  async getMode(groupeJid) {
    const prefs = await this._chargerPrefs(groupeJid);
    return prefs?.ainoria_mode || 'off';
  }

  async setMode(groupeJid, mode) {
    if (!Object.values(MODES_AINORIA).includes(mode)) {
      throw new Error(`Mode invalide : ${mode}. Modes: ${Object.values(MODES_AINORIA).join(', ')}`);
    }
    const db = getDB();
    const maintenant = Date.now();

    const existant = await db.get(
      `SELECT id FROM per_group_prefs WHERE user_id = ? AND group_jid = ?`,
      [this.userId, groupeJid]
    );

    if (existant) {
      await db.run(
        `UPDATE per_group_prefs SET ainoria_mode = ?, updated_at = ? WHERE user_id = ? AND group_jid = ?`,
        [mode, maintenant, this.userId, groupeJid]
      );
    } else {
      await db.run(
        `INSERT INTO per_group_prefs (user_id, group_jid, ainoria_mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [this.userId, groupeJid, mode, maintenant, maintenant]
      );
    }

    log.info(`[${this.userId}] Groupe ${groupeJid} → mode ${mode}`);
    return { groupeJid, mode, updatedAt: maintenant };
  }

  async setSummary(groupeJid, active) {
    return this._updatePref(groupeJid, { auto_summary: active ? 1 : 0 });
  }

  async setAnalysis(groupeJid, active) {
    return this._updatePref(groupeJid, { auto_analysis: active ? 1 : 0 });
  }

  async setAssistance(groupeJid, active) {
    return this._updatePref(groupeJid, { auto_assistance: active ? 1 : 0 });
  }

  async setModeration(groupeJid, niveau) {
    return this._updatePref(groupeJid, { moderation_level: niveau });
  }

  async setCustomPrompt(groupeJid, prompt) {
    return this._updatePref(groupeJid, { custom_prompt: prompt });
  }

  async listerGroupes() {
    const db = getDB();
    return db.all(
      `SELECT * FROM per_group_prefs WHERE user_id = ? ORDER BY group_name ASC`,
      [this.userId]
    );
  }

  async getGroupesResumes() {
    const db = getDB();
    const rows = await db.all(
      `SELECT group_jid, group_name, ainoria_mode, auto_summary, auto_analysis, auto_assistance
       FROM per_group_prefs WHERE user_id = ? ORDER BY group_name ASC`,
      [this.userId]
    );

    return rows.map(r => ({
      jid: r.group_jid,
      nom: r.group_name || 'Groupe inconnu',
      mode: r.ainoria_mode,
      resumeAuto: !!r.auto_summary,
      analyseAuto: !!r.auto_analysis,
      assistanceAuto: !!r.auto_assistance,
    }));
  }

  async _chargerPrefs(groupeJid) {
    const db = getDB();
    return db.get(
      `SELECT * FROM per_group_prefs WHERE user_id = ? AND group_jid = ?`,
      [this.userId, groupeJid]
    );
  }

  async _updatePref(groupeJid, champs) {
    const db = getDB();
    const maintenant = Date.now();
    const existant = await this._chargerPrefs(groupeJid);

    if (existant) {
      const sets = Object.keys(champs).map(k => `${k} = ?`).join(', ');
      const vals = Object.values(champs);
      await db.run(
        `UPDATE per_group_prefs SET ${sets}, updated_at = ? WHERE user_id = ? AND group_jid = ?`,
        [...vals, maintenant, this.userId, groupeJid]
      );
    } else {
      await db.run(
        `INSERT INTO per_group_prefs (user_id, group_jid, created_at, updated_at, ${Object.keys(champs).join(', ')})
         VALUES (?, ?, ?, ?, ${Object.values(champs).map(() => '?').join(', ')})`,
        [this.userId, groupeJid, maintenant, maintenant, ...Object.values(champs)]
      );
    }
  }
}

const STORE_CACHE = new Map();

export function getPermissionsStore(userId) {
  if (!STORE_CACHE.has(userId)) {
    STORE_CACHE.set(userId, new PermissionsStore(userId));
  }
  return STORE_CACHE.get(userId);
}
