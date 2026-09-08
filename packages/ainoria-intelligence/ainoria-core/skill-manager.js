import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';
import { toolEngine } from './tool-engine.js';

const log = createLogger('SKILL-MGR');

export const BUILTIN_SKILLS = {
  whatsapp: { name: 'whatsapp', label: 'WhatsApp', description: 'Messagerie WhatsApp (envoi, reception, groupes)', version: '1.0', dependencies: [], defaultEnabled: true },
  calendrier: { name: 'calendrier', label: 'Calendrier', description: 'Agenda, rappels et planification', version: '1.0', dependencies: ['whatsapp'], defaultEnabled: true },
  recherche: { name: 'recherche', label: 'Recherche', description: 'Recherche dans messages et memoire', version: '1.0', dependencies: [], defaultEnabled: true },
  vision: { name: 'vision', label: 'Vision IA', description: 'Analyse d\'images et OCR', version: '0.5', dependencies: [], defaultEnabled: true },
  documents: { name: 'documents', label: 'Documents', description: 'Gestion de fichiers et documents', version: '1.0', dependencies: [], defaultEnabled: true },
  traduction: { name: 'traduction', label: 'Traduction', description: 'Traduction multilingue', version: '1.0', dependencies: [], defaultEnabled: true },
  audio: { name: 'audio', label: 'Audio', description: 'Traitement audio et transcription', version: '0.5', dependencies: [], defaultEnabled: true },
  securite: { name: 'securite', label: 'Securite', description: 'Surveillance et permissions', version: '1.0', dependencies: [], defaultEnabled: true },
  developpement: { name: 'developpement', label: 'Developpement', description: 'Aide au code et scripts', version: '0.5', dependencies: [], defaultEnabled: false },
  marketing: { name: 'marketing', label: 'Marketing', description: 'Campagnes et analyse marketing', version: '0.5', dependencies: ['whatsapp'], defaultEnabled: false },
};

export class SkillManager {
  constructor() {
    this.skills = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_skills (
        name TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        version TEXT DEFAULT '1.0',
        enabled INTEGER DEFAULT 1,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        config TEXT DEFAULT '{}'
      )`);
      this.initialized = true;
      this._seedBuiltins();
      this._loadFromDB();
      log.info(`Skill Manager initialise — ${this.skills.size} competences`);
    } catch (err) {
      log.error(`Init Skill Manager: ${err.message}`);
    }
  }

  _seedBuiltins() {
    for (const [name, def] of Object.entries(BUILTIN_SKILLS)) {
      const existing = rawGet('SELECT name FROM ainoria_skills WHERE name = ?', name);
      if (!existing) {
        rawRun('INSERT INTO ainoria_skills (name, label, description, version, enabled, installed_at, updated_at, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          name, def.label, def.description, def.version, def.defaultEnabled ? 1 : 0, Date.now(), Date.now(), '{}');
      }
    }
  }

  _loadFromDB() {
    try {
      const rows = rawAll('SELECT * FROM ainoria_skills');
      for (const row of rows) {
        const def = BUILTIN_SKILLS[row.name] || {};
        this.skills.set(row.name, {
          name: row.name,
          label: row.label,
          description: row.description,
          version: row.version,
          enabled: row.enabled === 1,
          installedAt: row.installed_at,
          updatedAt: row.updated_at,
          config: JSON.parse(row.config || '{}'),
          dependencies: def.dependencies || [],
          builtin: !!BUILTIN_SKILLS[row.name],
        });
      }
    } catch {}
  }

  async install(name, def) {
    const now = Date.now();
    rawRun('INSERT OR REPLACE INTO ainoria_skills (name, label, description, version, enabled, installed_at, updated_at, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      name, def.label || name, def.description || '', def.version || '1.0', def.enabled !== false ? 1 : 0, now, now, JSON.stringify(def.config || {}));
    this._loadFromDB();
    log.info(`Skill installee: ${name} v${def.version || '1.0'}`);
    return this.skills.get(name);
  }

  uninstall(name) {
    if (BUILTIN_SKILLS[name]) {
      this.disable(name);
      return false;
    }
    rawRun('DELETE FROM ainoria_skills WHERE name = ?', name);
    this.skills.delete(name);
    log.info(`Skill desinstallee: ${name}`);
    return true;
  }

  enable(name) {
    rawRun('UPDATE ainoria_skills SET enabled = 1, updated_at = ? WHERE name = ?', Date.now(), name);
    const skill = this.skills.get(name);
    if (skill) skill.enabled = true;
    log.info(`Skill activee: ${name}`);
  }

  disable(name) {
    rawRun('UPDATE ainoria_skills SET enabled = 0, updated_at = ? WHERE name = ?', Date.now(), name);
    const skill = this.skills.get(name);
    if (skill) skill.enabled = false;
    log.info(`Skill desactivee: ${name}`);
  }

  isEnabled(name) {
    return this.skills.get(name)?.enabled ?? false;
  }

  getSkill(name) {
    return this.skills.get(name) || null;
  }

  list() {
    return Array.from(this.skills.values());
  }

  listEnabled() {
    return Array.from(this.skills.values()).filter(s => s.enabled);
  }

  getStats() {
    const all = this.list();
    return { total: all.length, enabled: all.filter(s => s.enabled).length, disabled: all.filter(s => !s.enabled).length, builtin: all.filter(s => s.builtin).length };
  }
}

export const skillManager = new SkillManager();
export default skillManager;
