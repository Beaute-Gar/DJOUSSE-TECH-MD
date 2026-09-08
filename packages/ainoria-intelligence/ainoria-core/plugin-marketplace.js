import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';
import { toolEngine } from './tool-engine.js';
import { skillManager } from './skill-manager.js';

const log = createLogger('PLUGIN-MKT');

export class PluginMarketplace {
  constructor() {
    this.plugins = new Map();
    this.registry = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT,
        version TEXT DEFAULT '1.0',
        author TEXT DEFAULT 'system',
        type TEXT DEFAULT 'native',
        mcp_server_id TEXT,
        skills TEXT DEFAULT '[]',
        tools TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        config TEXT DEFAULT '{}',
        homepage TEXT,
        license TEXT DEFAULT 'MIT'
      )`);
      this.initialized = true;
      this._loadFromDB();
      log.info(`Plugin Marketplace initialise — ${this.plugins.size} plugins`);
    } catch (err) {
      log.error(`Init Plugin Marketplace: ${err.message}`);
    }
  }

  _loadFromDB() {
    try {
      const rows = rawAll('SELECT * FROM ainoria_plugins ORDER BY name');
      for (const row of rows) {
        this.plugins.set(row.id, {
          id: row.id,
          name: row.name,
          label: row.label,
          description: row.description,
          version: row.version,
          author: row.author,
          skills: JSON.parse(row.skills || '[]'),
          tools: JSON.parse(row.tools || '[]'),
          enabled: row.enabled === 1,
          installedAt: row.installed_at,
          updatedAt: row.updated_at,
          config: JSON.parse(row.config || '{}'),
          homepage: row.homepage,
          license: row.license,
        });
      }
    } catch {}
  }

  async register(pluginDef) {
    await this.init();
    const id = pluginDef.id || `plugin_${pluginDef.name}_${Date.now()}`;
    const now = Date.now();
    const skills = JSON.stringify(pluginDef.skills || []);
    const tools = JSON.stringify(pluginDef.tools || []);

    const type = pluginDef.type || 'native';
    const mcpServerId = pluginDef.mcpServerId || null;

    const existing = rawGet('SELECT id FROM ainoria_plugins WHERE name = ?', pluginDef.name);
    if (existing) {
      rawRun('UPDATE ainoria_plugins SET version = ?, description = ?, type = ?, mcp_server_id = ?, skills = ?, tools = ?, updated_at = ?, config = ? WHERE id = ?',
        pluginDef.version || '1.0', pluginDef.description || '', type, mcpServerId, skills, tools, now, JSON.stringify(pluginDef.config || {}), existing.id);
      this._loadFromDB();
      log.info(`Plugin mis a jour: ${pluginDef.name}`);
      return this.plugins.get(existing.id);
    }

    rawRun('INSERT INTO ainoria_plugins (id, name, label, description, version, author, type, mcp_server_id, skills, tools, enabled, installed_at, updated_at, config, homepage, license) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, pluginDef.name, pluginDef.label || pluginDef.name, pluginDef.description || '', pluginDef.version || '1.0',
      pluginDef.author || 'system', type, mcpServerId, skills, tools, pluginDef.enabled !== false ? 1 : 0, now, now,
      JSON.stringify(pluginDef.config || {}), pluginDef.homepage || '', pluginDef.license || 'MIT');

    this._loadFromDB();

    if (type === 'mcp' && mcpServerId) {
      this._connectMCPPlugin(pluginDef, mcpServerId).catch(err => {
        log.warn(`Connexion MCP plugin ${pluginDef.name}: ${err.message}`);
      });
    }

    if (pluginDef.skills) {
      for (const skillName of pluginDef.skills) {
        skillManager.enable(skillName);
      }
    }
    if (pluginDef.tools) {
      for (const toolDef of pluginDef.tools) {
        toolEngine.register(toolDef);
      }
    }

    log.info(`Plugin installe: ${pluginDef.name} v${pluginDef.version || '1.0'} (type: ${type})`);
    return this.plugins.get(id);
  }

  uninstall(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    rawRun('DELETE FROM ainoria_plugins WHERE id = ?', pluginId);
    this.plugins.delete(pluginId);
    log.info(`Plugin desinstalle: ${plugin.name}`);
    return true;
  }

  enable(pluginId) {
    rawRun('UPDATE ainoria_plugins SET enabled = 1, updated_at = ? WHERE id = ?', Date.now(), pluginId);
    const p = this.plugins.get(pluginId);
    if (p) { p.enabled = true; }
  }

  disable(pluginId) {
    rawRun('UPDATE ainoria_plugins SET enabled = 0, updated_at = ? WHERE id = ?', Date.now(), pluginId);
    const p = this.plugins.get(pluginId);
    if (p) { p.enabled = false; }
  }

  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  findByName(name) {
    return Array.from(this.plugins.values()).find(p => p.name === name) || null;
  }

  list() {
    return Array.from(this.plugins.values());
  }

  listEnabled() {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  async _connectMCPPlugin(pluginDef, mcpServerId) {
    try {
      const { mcpManager } = await import('./mcp/mcp-manager.js');
      await mcpManager.connect(pluginDef.name, {
        id: mcpServerId,
        transport: pluginDef.transport || 'stdio',
        command: pluginDef.command,
        url: pluginDef.url,
        label: pluginDef.label || pluginDef.name,
        ...pluginDef.mcpConfig,
      });
      log.info(`Plugin MCP connecté: ${pluginDef.name}`);
    } catch (err) {
      log.warn(`Échec connexion plugin MCP ${pluginDef.name}: ${err.message}`);
    }
  }

  getStats() {
    const all = this.list();
    return { total: all.length, enabled: all.filter(p => p.enabled).length, mcpPlugins: all.filter(p => p.type === 'mcp').length, needsUpdate: 0 };
  }
}

export const pluginMarketplace = new PluginMarketplace();
export default pluginMarketplace;
