import { createLogger } from '../../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../../infrastructure/database/database.js';

const log = createLogger('MCP-PERM');

export class McpPermission {
  constructor() {
    this._cache = new Map();
    this._cacheTTL = 30000;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_mcp_permissions (
        id TEXT PRIMARY KEY,
        jid TEXT NOT NULL,
        server_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        permission_type TEXT DEFAULT 'tool',
        granted INTEGER DEFAULT 0,
        granted_at INTEGER,
        expires_at INTEGER,
        granted_by TEXT DEFAULT 'user',
        UNIQUE(jid, server_id, tool_name)
      )`);
      this.initialized = true;
      log.info('Module permissions MCP initialisé');
    } catch (err) {
      log.error(`Init permissions MCP: ${err.message}`);
    }
  }

  async defineToolPermission(serverId, toolName, permission) {
    log.info(`Permission définie: ${permission} pour ${serverId}/${toolName}`);
    return { serverId, toolName, permission };
  }

  async checkToolAccess(serverId, toolName, agentName, jid) {
    const cacheKey = `${jid}:${serverId}:${toolName}`;
    const cached = this._cache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < this._cacheTTL) return cached.allowed;

    const perm = this._checkPermission(jid, serverId, toolName);
    const result = { allowed: perm, serverId, toolName, agentName, jid };

    if (perm) {
      this._cache.set(cacheKey, { allowed: true, ts: Date.now() });
      return true;
    }

    const globalPerm = this._checkPermission(jid, serverId, '*');
    if (globalPerm) {
      this._cache.set(cacheKey, { allowed: true, ts: Date.now() });
      return true;
    }

    this._cache.set(cacheKey, { allowed: false, ts: Date.now() });
    return false;
  }

  _checkPermission(jid, serverId, toolName) {
    try {
      const row = rawGet(
        'SELECT granted FROM ainoria_mcp_permissions WHERE jid = ? AND server_id = ? AND tool_name = ?',
        jid, serverId, toolName
      );
      if (row && row.granted === 1) {
        if (row.expires_at && row.expires_at < Date.now()) return false;
        return true;
      }
    } catch {}
    return false;
  }

  async requestUserConsent(serverId, toolName, jid) {
    log.info(`Consentement requis: ${jid} pour ${serverId}/${toolName}`);
    return { required: true, message: `Permission requise pour ${serverId}/${toolName}` };
  }

  async grant(jid, serverId, toolName, grantedBy = 'user', expiresAt = null) {
    const id = `mcp_perm_${jid}_${serverId}_${toolName}`;
    try {
      rawRun(
        `INSERT OR REPLACE INTO ainoria_mcp_permissions (id, jid, server_id, tool_name, granted, granted_at, expires_at, granted_by)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        id, jid, serverId, toolName, Date.now(), expiresAt, grantedBy
      );
      this._cache.delete(`${jid}:${serverId}:${toolName}`);
      log.info(`Permission accordée: ${jid} peut utiliser ${serverId}/${toolName}`);
      return { success: true, id };
    } catch (err) {
      log.error(`Erreur grant permission: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  listGrantedPermissions(jid) {
    try {
      return rawAll(
        'SELECT server_id, tool_name, granted_at, expires_at FROM ainoria_mcp_permissions WHERE jid = ? AND granted = 1',
        jid
      );
    } catch {
      return [];
    }
  }

  async revokePermission(jid, serverId, toolName) {
    try {
      rawRun(
        'UPDATE ainoria_mcp_permissions SET granted = 0 WHERE jid = ? AND server_id = ? AND tool_name = ?',
        jid, serverId, toolName
      );
      this._cache.delete(`${jid}:${serverId}:${toolName}`);
      log.info(`Permission révoquée: ${jid} / ${serverId}/${toolName}`);
      return true;
    } catch (err) {
      log.error(`Erreur révocation permission: ${err.message}`);
      return false;
    }
  }

  getStats() {
    try {
      const total = rawGet('SELECT COUNT(*) as n FROM ainoria_mcp_permissions');
      const granted = rawGet('SELECT COUNT(*) as n FROM ainoria_mcp_permissions WHERE granted = 1');
      return {
        total: total?.n || 0,
        granted: granted?.n || 0,
        cacheSize: this._cache.size,
      };
    } catch {
      return { total: 0, granted: 0, cacheSize: this._cache.size };
    }
  }
}

export const mcpPermission = new McpPermission();
