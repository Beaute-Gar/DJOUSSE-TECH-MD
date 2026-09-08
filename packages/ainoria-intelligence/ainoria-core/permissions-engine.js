import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('PERMS-CORE');

export const PERMISSION_DEFINITIONS = {

  envoyer_message: {
    label: 'Envoyer un message',
    description: 'Autoriser l\'envoi de messages texte',
    sensitive: false,
    defaultFor: ['agent_whatsapp', 'agent_calendrier'],
  },
  envoyer_media: {
    label: 'Envoyer des médias',
    description: 'Images, vidéos, documents, audio',
    sensitive: false,
    defaultFor: ['agent_whatsapp'],
  },
  lire_conversations: {
    label: 'Lire les conversations',
    description: 'Accéder au contenu des messages reçus',
    sensitive: true,
    defaultFor: ['agent_whatsapp', 'agent_securite'],
  },
  acceder_groupes: {
    label: 'Accéder aux groupes',
    description: 'Voir la liste et les métadonnées des groupes',
    sensitive: false,
    defaultFor: ['agent_whatsapp', 'agent_documents'],
  },
  modifier_message: {
    label: 'Modifier un message',
    description: 'Éditer les messages déjà envoyés',
    sensitive: true,
    defaultFor: [],
  },
  supprimer_message: {
    label: 'Supprimer un message',
    description: 'Effacer des messages',
    sensitive: true,
    defaultFor: [],
  },
  programmer_envoi: {
    label: 'Programmer un envoi',
    description: 'Planifier l\'envoi différé de messages',
    sensitive: false,
    defaultFor: ['agent_whatsapp', 'agent_calendrier'],
  },
  rechercher: {
    label: 'Rechercher',
    description: 'Rechercher dans les messages et la mémoire',
    sensitive: false,
    defaultFor: ['agent_whatsapp', 'agent_documents'],
  },
  analyser: {
    label: 'Analyser',
    description: 'Analyser et résumer des conversations',
    sensitive: false,
    defaultFor: ['agent_whatsapp'],
  },
  creer_automatisation: {
    label: 'Créer une automatisation',
    description: 'Mettre en place des réponses automatiques',
    sensitive: true,
    defaultFor: [],
  },
  gerer_agenda: {
    label: 'Gérer l\'agenda',
    description: 'Créer/modifier des événements calendrier',
    sensitive: true,
    defaultFor: ['agent_calendrier'],
  },
  acceder_fichiers: {
    label: 'Accéder aux fichiers',
    description: 'Lire les documents et fichiers stockés',
    sensitive: true,
    defaultFor: ['agent_documents'],
  },
  gerer_securite: {
    label: 'Gérer la sécurité',
    description: 'Modifier les règles et permissions',
    sensitive: true,
    defaultFor: ['agent_securite'],
  },
  executer_code: {
    label: 'Exécuter du code',
    description: 'Lancer des scripts ou commandes',
    sensitive: true,
    defaultFor: [],
  },
};

export class PermissionsEngine {
  constructor() {
    this.initialized = false;
    this.cache = new Map();
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT NOT NULL,
        permission TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 1,
        requires_confirmation INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        UNIQUE(agent, permission)
      )`);
      this.initialized = true;
      this._seedDefaults();
      log.info('Permissions Engine initialisé');
    } catch (err) {
      log.error(`Init permissions: ${err.message}`);
    }
  }

  _seedDefaults() {
    const count = rawGet('SELECT COUNT(*) as c FROM ainoria_permissions')?.c || 0;
    if (count > 0) return;
    const seen = new Set();
    for (const [permKey, def] of Object.entries(PERMISSION_DEFINITIONS)) {
      for (const agent of def.defaultFor || []) {
        const key = `${agent}:${permKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rawRun('INSERT INTO ainoria_permissions (agent, permission, granted, requires_confirmation, created_at) VALUES (?, ?, 1, ?, ?)',
          agent, permKey, def.sensitive ? 1 : 0, Date.now());
      }
    }
    log.info(`Permissions par défaut initialisées (${seen.size} entrées)`);
  }

  async check(agentName, permission, context = {}) {
    const cached = this.cache.get(`${agentName}:${permission}`);
    if (cached !== undefined) return cached;

    const row = rawGet('SELECT granted, requires_confirmation FROM ainoria_permissions WHERE agent = ? AND permission = ?', agentName, permission);
    if (!row) return false;

    const allowed = row.granted === 1;
    if (allowed && row.requires_confirmation && !context.confirmed) {
      return { allowed: false, requiresConfirmation: true, message: `Permission ${permission} nécessite confirmation` };
    }

    this.cache.set(`${agentName}:${permission}`, allowed);
    return allowed;
  }

  async require(agentName, permission, context = {}) {
    const result = await this.check(agentName, permission, context);
    if (result === true) return true;
    if (typeof result === 'object' && result.requiresConfirmation) {
      return result;
    }
    log.warn(`[PERMS] Refus: ${agentName} → ${permission}`);
    return false;
  }

  grant(agentName, permission) {
    try {
      rawRun('INSERT OR REPLACE INTO ainoria_permissions (agent, permission, granted, requires_confirmation, created_at) VALUES (?, ?, 1, ?, ?)',
        agentName, permission, PERMISSION_DEFINITIONS[permission]?.sensitive ? 1 : 0, Date.now());
      this.cache.set(`${agentName}:${permission}`, true);
      return true;
    } catch (err) {
      log.error(`Grant error: ${err.message}`);
      return false;
    }
  }

  revoke(agentName, permission) {
    rawRun('UPDATE ainoria_permissions SET granted = 0 WHERE agent = ? AND permission = ?', agentName, permission);
    this.cache.set(`${agentName}:${permission}`, false);
  }

  listForAgent(agentName) {
    const rows = rawAll('SELECT * FROM ainoria_permissions WHERE agent = ?', agentName);
    return rows.map(r => ({
      permission: r.permission,
      granted: r.granted === 1,
      requiresConfirmation: r.requires_confirmation === 1,
      definition: PERMISSION_DEFINITIONS[r.permission] || null,
    }));
  }

  listAll() {
    const rows = rawAll('SELECT * FROM ainoria_permissions ORDER BY agent, permission');
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.agent]) grouped[r.agent] = [];
      grouped[r.agent].push({
        permission: r.permission,
        granted: r.granted === 1,
        requiresConfirmation: r.requires_confirmation === 1,
      });
    }
    return grouped;
  }

  invalidateCache() {
    this.cache.clear();
  }
}

export const permissionsEngine = new PermissionsEngine();
export default permissionsEngine;
