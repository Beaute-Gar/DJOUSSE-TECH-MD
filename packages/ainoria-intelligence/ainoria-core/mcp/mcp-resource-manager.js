import { createLogger } from '../../../infrastructure/logger.js';

const log = createLogger('MCP-RESOURCE');

export class McpResourceManager {
  constructor() {
    this._resources = new Map();
    this._cache = new Map();
    this._cacheTTL = 60000;
    this.stats = { registered: 0, reads: 0, errors: 0 };
  }

  async registerServerResources(serverId, resources = []) {
    const key = `server:${serverId}`;
    const existing = this._resources.get(key) || [];
    const merged = [...existing];

    for (const res of resources) {
      if (!merged.find(r => r.uri === res.uri)) {
        merged.push({ ...res, serverId });
        this.stats.registered++;
      }
    }

    this._resources.set(key, merged);
    log.info(`${resources.length} resources MCP enregistrées pour ${serverId}`);
    return merged;
  }

  unregisterServerResources(serverId) {
    const key = `server:${serverId}`;
    const removed = this._resources.get(key)?.length || 0;
    this._resources.delete(key);
    log.info(`${removed} resources MCP retirées pour ${serverId}`);
  }

  listResources(filterServerId = null) {
    const all = [];
    for (const [, resources] of this._resources) {
      for (const res of resources) {
        if (!filterServerId || res.serverId === filterServerId) {
          all.push(res);
        }
      }
    }
    return all;
  }

  async readResource(uri) {
    const cached = this._cache.get(uri);
    if (cached && (Date.now() - cached.ts) < this._cacheTTL) {
      return cached.data;
    }

    for (const [, resources] of this._resources) {
      const res = resources.find(r => r.uri === uri);
      if (res) {
        this.stats.reads++;
        try {
          const { mcpManager } = await import('./mcp-manager.js');
          const client = mcpManager.getClient(res.serverId);
          if (client) {
            const data = await client.readResource(uri);
            this._cache.set(uri, { data, ts: Date.now() });
            return data;
          }
        } catch (err) {
          this.stats.errors++;
          log.warn(`Erreur lecture resource ${uri}: ${err.message}`);
          return null;
        }
      }
    }
    return null;
  }

  async buildMCPContext(jid, options = {}) {
    const context = [];
    const allResources = this.listResources();

    for (const res of allResources.slice(0, 5)) {
      try {
        const data = await this.readResource(res.uri);
        if (data) {
          context.push({ uri: res.uri, name: res.name, data });
        }
      } catch {}
    }

    return context;
  }

  getStats() {
    return {
      ...this.stats,
      totalResources: this.listResources().length,
      serversWithResources: this._resources.size,
      cacheSize: this._cache.size,
    };
  }
}

export const mcpResourceManager = new McpResourceManager();
