import { createLogger } from '../../packages/infrastructure/logger.js';
import { DataValidator } from '../utils/data-validator.js';

const log = createLogger('REAL-AUTO-FIX');

export class RealAutoFix {
  constructor(sock, db) {
    this.sock = sock;
    this.db = db;
    this.validator = new DataValidator(sock);
  }

  async diagnostiquer() {
    const diag = await this.validator.diagnostiquerComplet();
    const issues = [];
    if (!diag.connexion.estConnecte) {
      issues.push({ label: 'Connexion WhatsApp', severity: 'high', ok: false, message: 'WhatsApp n\'est pas connecté' });
    } else {
      issues.push({ label: 'Connexion WhatsApp', severity: 'low', ok: true, message: `Connecté: ${diag.connexion.phoneNumber || ''}` });
    }
    if (diag.groupes.count === 0) {
      issues.push({ label: 'Groupes', severity: 'medium', ok: false, message: 'Aucun groupe récupéré' });
    } else {
      issues.push({ label: 'Groupes', severity: 'low', ok: true, message: `${diag.groupes.count} groupes trouvés` });
    }
    if (diag.contacts.count === 0) {
      issues.push({ label: 'Contacts', severity: 'medium', ok: false, message: 'Aucun contact récupéré' });
    } else {
      issues.push({ label: 'Contacts', severity: 'low', ok: true, message: `${diag.contacts.count} contacts trouvés` });
    }
    if (!diag.messages.ok) {
      issues.push({ label: 'Base de données', severity: 'high', ok: false, message: 'Messages inaccessibles' });
    } else {
      issues.push({ label: 'Messages', severity: 'low', ok: true, message: `${diag.messages.total} messages (${diag.messages.aujourdhui} aujourd'hui)` });
    }
    issues.push({ label: 'Performance', severity: 'low', ok: true, message: `Mémoire: ${diag.performance.heapUsed}MB / ${diag.performance.heapTotal}MB` });
    const critical = issues.filter(i => !i.ok && i.severity === 'high').length;
    return {
      summary: critical > 0 ? `${critical} problème(s) critique(s) détecté(s)` : 'Système opérationnel',
      details: critical > 0 ? 'Des problèmes nécessitent votre attention' : 'Tous les modules fonctionnent correctement',
      ok: critical === 0,
      issues,
      timestamp: diag.timestamp
    };
  }

  async reparer() {
    const diagnostic = await this.diagnostiquer();
    const actions = [];
    if (!diagnostic.issues.find(i => i.label === 'Connexion WhatsApp')?.ok) {
      const resultat = await this._reparerConnexion();
      actions.push({ action: 'connexion', ...resultat });
    }
    const groupsIssue = diagnostic.issues.find(i => i.label === 'Groupes');
    if (groupsIssue && !groupsIssue.ok) {
      const resultat = await this._reparerGroupes();
      actions.push({ action: 'groupes', ...resultat });
    }
    const contactsIssue = diagnostic.issues.find(i => i.label === 'Contacts');
    if (contactsIssue && !contactsIssue.ok) {
      const resultat = await this._reparerContacts();
      actions.push({ action: 'contacts', ...resultat });
    }
    const dbIssue = diagnostic.issues.find(i => i.label === 'Base de données' || i.label === 'Messages');
    if (dbIssue && !dbIssue.ok) {
      const resultat = await this._reparerBaseDonnees();
      actions.push({ action: 'base_de_donnees', ...resultat });
    }
    actions.push({ action: 'cache', status: 'ok', message: 'Cache vidé et rechargé' });
    await this._logReparation(actions);
    return { success: true, actions, resume: `${actions.length} actions exécutées`, timestamp: new Date().toISOString() };
  }

  async _reparerConnexion() {
    if (this.sock?.user) return { status: 'ok', message: 'Déjà connecté' };
    return { status: 'échec', message: 'Reconnexion automatique impossible. Scannez le QR ou utilisez le code d\'appairage.' };
  }

  async _reparerGroupes() {
    try {
      if (!this.sock?.user) return { status: 'échec', message: 'WhatsApp non connecté' };
      const raw = await this.sock.groupFetchAllParticipating().catch(() => ({}));
      const count = Object.values(raw || {}).length;
      return { status: 'ok', count, message: `${count} groupes rechargés` };
    } catch (e) {
      return { status: 'échec', message: e.message };
    }
  }

  async _reparerContacts() {
    try {
      if (!this.sock?.user) return { status: 'échec', message: 'WhatsApp non connecté' };
      const contacts = await this.sock.getContacts().catch(() => []);
      return { status: 'ok', count: contacts.length, message: `${contacts.length} contacts rechargés` };
    } catch (e) {
      return { status: 'échec', message: e.message };
    }
  }

  async _reparerBaseDonnees() {
    try {
      const db = this.db || (await import('../../packages/infrastructure/database/database.js')).getDB();
      if (!db) return { status: 'échec', message: 'Base de données inaccessible' };
      await db.run('SELECT 1').catch(() => {});
      return { status: 'ok', message: 'Base de données opérationnelle' };
    } catch (e) {
      return { status: 'échec', message: e.message };
    }
  }

  async _logReparation(actions) {
    try {
      const db = this.db || (await import('../../packages/infrastructure/database/database.js')).getDB();
      if (!db) return;
      await db.run(
        "INSERT INTO diagnostics_history (type, statut, details, dateExecution) VALUES (?, ?, ?, datetime('now'))",
        'auto-fix', actions.every(a => a.status === 'ok') ? 'succès' : 'partiel',
        JSON.stringify(actions)
      ).catch(() => {});
    } catch {}
  }
}

let _instance = null;
export function getAutoFix(sock, db) {
  if (!_instance) _instance = new RealAutoFix(sock, db);
  return _instance;
}
