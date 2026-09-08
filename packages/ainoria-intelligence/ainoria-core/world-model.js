import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('WORLD-MODEL');

export const ENTITY_TYPES = {
  PERSON: 'person',
  GROUP: 'group',
  PROJECT: 'project',
  COMPANY: 'company',
  EVENT: 'event',
  LOCATION: 'location',
  TASK: 'task',
  HABIT: 'habit',
  DOCUMENT: 'document',
  NOTE: 'note',
};

export const RELATION_TYPES = {
  MEMBER_OF: 'member_of',
  WORKS_AT: 'works_at',
  KNOWS: 'knows',
  PART_OF: 'part_of',
  RELATED_TO: 'related_to',
  LOCATED_AT: 'located_at',
  ASSIGNED_TO: 'assigned_to',
  CREATED_BY: 'created_by',
  FREQUENT_CONTACT: 'frequent_contact',
  REPORTS_TO: 'reports_to',
};

export class WorldModel {
  constructor() {
    this.initialized = false;
    this.cache = { entities: new Map(), relations: new Map() };
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_world_entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        properties TEXT DEFAULT '{}',
        importance INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_world_relations (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        weight INTEGER DEFAULT 1,
        properties TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_world_entities_type ON ainoria_world_entities(type)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_world_entities_name ON ainoria_world_entities(name)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_world_relations_source ON ainoria_world_relations(source_id)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_world_relations_target ON ainoria_world_relations(target_id)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_world_relations_type ON ainoria_world_relations(type)`);
      this.initialized = true;
      log.info('World Model initialise');
    } catch (err) {
      log.error(`Init World Model: ${err.message}`);
    }
  }

  _id(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  addEntity(type, name, properties = {}, importance = 0) {
    const id = this._id('ent');
    const existing = this.findEntityByName(name);
    if (existing) {
      this.updateEntity(existing.id, { properties, importance });
      return existing.id;
    }
    const now = Date.now();
    rawRun('INSERT INTO ainoria_world_entities (id, type, name, aliases, properties, importance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, type, name.slice(0, 200), '[]', JSON.stringify(properties), importance, now, now);
    this.cache.entities.set(id, { id, type, name, properties, importance });
    return id;
  }

  updateEntity(id, updates = {}) {
    const existing = rawGet('SELECT * FROM ainoria_world_entities WHERE id = ?', id);
    if (!existing) return false;
    const props = updates.properties ? { ...JSON.parse(existing.properties || '{}'), ...updates.properties } : JSON.parse(existing.properties || '{}');
    const importance = updates.importance ?? existing.importance;
    const name = updates.name || existing.name;
    rawRun('UPDATE ainoria_world_entities SET name = ?, properties = ?, importance = ?, updated_at = ? WHERE id = ?',
      name, JSON.stringify(props), importance, Date.now(), id);
    return true;
  }

  removeEntity(id) {
    rawRun('DELETE FROM ainoria_world_entities WHERE id = ?', id);
    rawRun('DELETE FROM ainoria_world_relations WHERE source_id = ? OR target_id = ?', id, id);
    this.cache.entities.delete(id);
  }

  getEntity(id) {
    try {
      const row = rawGet('SELECT * FROM ainoria_world_entities WHERE id = ?', id);
      if (!row) return null;
      return { ...row, properties: JSON.parse(row.properties || '{}'), aliases: JSON.parse(row.aliases || '[]') };
    } catch { return null; }
  }

  findEntityByName(name, type = null) {
    const sql = type
      ? 'SELECT * FROM ainoria_world_entities WHERE (name = ? OR aliases LIKE ?) AND type = ? LIMIT 1'
      : 'SELECT * FROM ainoria_world_entities WHERE name = ? OR aliases LIKE ? LIMIT 1';
    const params = type ? [name, `%"${name}"%`, type] : [name, `%"${name}"%`];
    try {
      const row = rawGet(sql, ...params);
      return row ? { ...row, properties: JSON.parse(row.properties || '{}') } : null;
    } catch { return null; }
  }

  searchEntities(query, type = null, limit = 20) {
    const sql = type
      ? 'SELECT * FROM ainoria_world_entities WHERE (name LIKE ? OR aliases LIKE ?) AND type = ? ORDER BY importance DESC LIMIT ?'
      : 'SELECT * FROM ainoria_world_entities WHERE name LIKE ? OR aliases LIKE ? ORDER BY importance DESC LIMIT ?';
    const like = `%${query}%`;
    const params = type ? [like, like, type, limit] : [like, like, limit];
    try {
      return rawAll(sql, ...params).map(r => ({ ...r, properties: JSON.parse(r.properties || '{}'), aliases: JSON.parse(r.aliases || '[]') }));
    } catch { return []; }
  }

  listByType(type, limit = 50) {
    try {
      return rawAll('SELECT * FROM ainoria_world_entities WHERE type = ? ORDER BY importance DESC LIMIT ?', type, limit)
        .map(r => ({ ...r, properties: JSON.parse(r.properties || '{}') }));
    } catch { return []; }
  }

  addRelation(sourceId, targetId, type, weight = 1, properties = {}) {
    const id = this._id('rel');
    const now = Date.now();
    const existing = rawGet('SELECT id FROM ainoria_world_relations WHERE source_id = ? AND target_id = ? AND type = ?', sourceId, targetId, type);
    if (existing) {
      rawRun('UPDATE ainoria_world_relations SET weight = weight + ?, updated_at = ? WHERE id = ?', weight, now, existing.id);
      return existing.id;
    }
    rawRun('INSERT INTO ainoria_world_relations (id, source_id, target_id, type, weight, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, sourceId, targetId, type, weight, JSON.stringify(properties), now, now);
    return id;
  }

  getRelations(entityId, type = null) {
    try {
      const sql = type
        ? 'SELECT * FROM ainoria_world_relations WHERE (source_id = ? OR target_id = ?) AND type = ? ORDER BY weight DESC'
        : 'SELECT * FROM ainoria_world_relations WHERE source_id = ? OR target_id = ? ORDER BY weight DESC';
      const rows = rawAll(sql, entityId, entityId);
      return rows.map(r => ({ ...r, properties: JSON.parse(r.properties || '{}') }));
    } catch { return []; }
  }

  getConnectedEntities(entityId, relationType = null) {
    const relations = this.getRelations(entityId, relationType);
    const connected = [];
    for (const rel of relations) {
      const otherId = rel.source_id === entityId ? rel.target_id : rel.source_id;
      const entity = this.getEntity(otherId);
      if (entity) connected.push({ entity, relation: rel });
    }
    return connected;
  }

  getContacts(jid, limit = 20) {
    const entity = this.findEntityByName(jid, ENTITY_TYPES.PERSON);
    if (!entity) return [];
    return this.getConnectedEntities(entity.id, RELATION_TYPES.KNOWS).slice(0, limit).map(c => c.entity);
  }

  getGroupsForContact(jid, limit = 10) {
    const entity = this.findEntityByName(jid, ENTITY_TYPES.PERSON);
    if (!entity) return [];
    return this.getConnectedEntities(entity.id, RELATION_TYPES.MEMBER_OF).slice(0, limit).map(c => c.entity);
  }

  async importFromWhatsApp(groups, contacts) {
    if (contacts) {
      for (const c of contacts.slice(0, 200)) {
        const jid = c.jid || c.id;
        if (!jid || jid.includes('status')) continue;
        const props = { jid, phone: jid.split('@')[0], notify: c.notify };
        this.addEntity(ENTITY_TYPES.PERSON, c.name || jid.split('@')[0], props, c.name ? 5 : 1);
      }
    }
    if (groups) {
      for (const [jid, meta] of Object.entries(groups)) {
        const props = { jid, size: meta.size || meta.participants?.length || 0, desc: meta.desc || '', owner: meta.owner };
        const groupEntity = this.addEntity(ENTITY_TYPES.GROUP, meta.subject || jid, props, 3);
        if (meta.participants) {
          for (const p of meta.participants) {
            const pJid = p.id || p;
            const pEntity = this.findEntityByName(pJid, ENTITY_TYPES.PERSON);
            if (pEntity) this.addRelation(pEntity.id, groupEntity, RELATION_TYPES.MEMBER_OF, 1);
          }
        }
      }
    }
    log.info(`World Model importe: ${Object.keys(groups || {}).length} groupes, ${(contacts || []).length} contacts`);
  }

  getStats() {
    try {
      const count = rawGet('SELECT COUNT(*) as c FROM ainoria_world_entities')?.c || 0;
      const relCount = rawGet('SELECT COUNT(*) as c FROM ainoria_world_relations')?.c || 0;
      const byType = {};
      const types = rawAll('SELECT type, COUNT(*) as c FROM ainoria_world_entities GROUP BY type');
      for (const t of types) byType[t.type] = t.c;
      return { entities: count, relations: relCount, byType, initialized: this.initialized };
    } catch { return { entities: 0, relations: 0, byType: {}, initialized: this.initialized }; }
  }
}

export const worldModel = new WorldModel();
export default worldModel;
