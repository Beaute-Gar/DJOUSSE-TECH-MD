import { createLogger } from '../../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../../infrastructure/database/database.js';
import { McpClient } from './mcp-client.js';
import { mcpToolAdapter } from './mcp-tool-adapter.js';
import { mcpServer } from './mcp-server.js';
import { mcpPermission } from './mcp-permission.js';
import { mcpResourceManager } from './mcp-resource-manager.js';

const log = createLogger('MCP-MANAGER');

export class McpManager {
  constructor() {
    this._servers = new Map();
    this._clients = new Map();
    this.initialized = false;
    this._enabled = false;
  }

  get enabled() { return this._enabled; }

  async init() {
    if (this.initialized) return;
    this._enabled = process.env.MCP_ENABLED === 'true';

    if (!this._enabled) {
      log.info('Module MCP désactivé (MCP_ENABLED=false)');
      this.initialized = true;
      return;
    }

    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        label TEXT,
        description TEXT,
        version TEXT DEFAULT '1.0',
        author TEXT DEFAULT 'unknown',
        transport TEXT DEFAULT 'stdio',
        command TEXT,
        url TEXT,
        headers TEXT DEFAULT '{}',
        tools TEXT DEFAULT '[]',
        status TEXT DEFAULT 'disconnected',
        config TEXT DEFAULT '{}',
        enabled INTEGER DEFAULT 1,
        last_seen INTEGER,
        error_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_mcp_logs (
        id TEXT PRIMARY KEY,
        server_id TEXT,
        tool_name TEXT NOT NULL,
        params TEXT DEFAULT '{}',
        caller TEXT,
        result TEXT,
        error TEXT,
        duration_ms INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )`);

      await mcpPermission.init();
      await mcpServer.start();
      await this._connectSavedServers();

      this.initialized = true;
      log.info(`MCP Manager initialisé — ${this._servers.size} serveurs`);
    } catch (err) {
      log.warn(`Init MCP Manager: ${err.message} (mode dégradé)`);
      this.initialized = true;
    }
  }

  async _connectSavedServers() {
    try {
      const servers = rawAll('SELECT * FROM ainoria_mcp_servers WHERE enabled = 1');
      for (const sv of servers) {
        try {
          const config = JSON.parse(sv.config || '{}');
          await this.connect(sv.name, {
            id: sv.id,
            transport: sv.transport,
            command: sv.command,
            url: sv.url,
            headers: JSON.parse(sv.headers || '{}'),
            ...config,
          });
        } catch (err) {
          log.warn(`Connexion auto échouée: ${sv.name}: ${err.message}`);
        }
      }
    } catch {}
  }

  async connect(name, config = {}) {
    if (!this._enabled) throw new Error('MCP désactivé (MCP_ENABLED=false)');

    const id = config.id || `mcp_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (this._servers.has(id)) {
      throw new Error(`Serveur MCP déjà connecté: ${name}`);
    }

    const client = new McpClient({ id, name, ...config });
    await client.connect();
    const tools = client._tools || [];

    this._clients.set(id, client);
    this._servers.set(id, { id, name, status: 'connected', tools, connectedAt: Date.now() });

    await mcpToolAdapter.registerServerTools(id, tools);
    await mcpResourceManager.registerServerResources(id, await client.listResources());
    for (const tool of tools) {
      await mcpPermission.defineToolPermission(id, tool.name, `mcp.${id}.${tool.name}`);
    }

    this._saveServer(id, name, config, tools);

    import('../event-bus-v2.js').then(({ eventBusV2 }) => {
      eventBusV2.emit('mcp:connected', { serverId: id, name, toolsCount: tools.length });
    }).catch(() => {});

    log.info(`Serveur MCP connecté: ${name} (${tools.length} outils)`);
    return { id, name, tools: tools.length };
  }

  async disconnect(serverId) {
    const client = this._clients.get(serverId);
    if (!client) throw new Error(`Serveur MCP inconnu: ${serverId}`);

    await client.disconnect();
    await mcpToolAdapter.unregisterServerTools(serverId);
    this._clients.delete(serverId);
    this._servers.delete(serverId);

    this._updateServerStatus(serverId, 'disconnected');

    import('../event-bus-v2.js').then(({ eventBusV2 }) => {
      eventBusV2.emit('mcp:disconnected', { serverId });
    }).catch(() => {});

    log.info(`Serveur MCP déconnecté: ${serverId}`);
    return { success: true };
  }

  async callTool(serverId, toolName, params = {}) {
    const client = this._clients.get(serverId);
    if (!client) throw new Error(`Serveur MCP déconnecté: ${serverId}`);

    const start = Date.now();
    try {
      const result = await client.callTool(toolName, params);
      const duration = Date.now() - start;
      this._logCall(serverId, toolName, params, result, null, duration);
      this._updateServerStatus(serverId, 'connected');
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      this._logCall(serverId, toolName, params, null, err.message, duration);
      this._updateServerStatus(serverId, 'error');
      throw err;
    }
  }

  listServers() {
    return Array.from(this._servers.values()).map(s => {
      const client = this._clients.get(s.id);
      return {
        ...s,
        connected: client ? client.isConnected() : false,
        stats: client ? client.getStats() : null,
      };
    });
  }

  getServer(serverId) {
    return this._servers.get(serverId) || null;
  }

  getClient(serverId) {
    return this._clients.get(serverId) || null;
  }

  _saveServer(id, name, config, tools) {
    try {
      rawRun(
        `INSERT OR REPLACE INTO ainoria_mcp_servers
         (id, name, label, transport, command, url, headers, tools, status, config, enabled, last_seen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, 1, ?, ?, ?)`,
        id, name, config.label || name,
        config.transport || 'stdio',
        config.command || null,
        config.url || null,
        JSON.stringify(config.headers || {}),
        JSON.stringify(tools.map(t => t.name)),
        JSON.stringify(config),
        Date.now(), Date.now(), Date.now()
      );
    } catch (err) {
      log.warn(`Erreur sauvegarde serveur MCP: ${err.message}`);
    }
  }

  _updateServerStatus(serverId, status) {
    try {
      rawRun('UPDATE ainoria_mcp_servers SET status = ?, last_seen = ?, updated_at = ? WHERE id = ?',
        status, Date.now(), Date.now(), serverId);
    } catch {}
  }

  _logCall(serverId, toolName, params, result, error, duration) {
    try {
      const id = `mcp_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      rawRun(
        `INSERT INTO ainoria_mcp_logs (id, server_id, tool_name, params, result, error, duration_ms, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id, serverId, toolName,
        JSON.stringify(params).slice(0, 1000),
        result ? JSON.stringify(result).slice(0, 1000) : null,
        error || null,
        duration,
        Date.now()
      );
    } catch {}
  }

  getLogs(limit = 50) {
    try {
      return rawAll('SELECT * FROM ainoria_mcp_logs ORDER BY timestamp DESC LIMIT ?', limit);
    } catch {
      return [];
    }
  }

  getStats() {
    return {
      enabled: this._enabled,
      initialized: this.initialized,
      servers: this._servers.size,
      connected: Array.from(this._clients.values()).filter(c => c.isConnected()).length,
      totalTools: Array.from(this._servers.values()).reduce((a, s) => a + (s.tools?.length || 0), 0),
    };
  }
}

export const mcpManager = new McpManager();
