import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';
import { permissionsEngine } from './permissions-engine.js';

const log = createLogger('TOOL-ENGINE');

export class ToolEngine {
  constructor() {
    this.tools = new Map();
    this.executionLog = [];
    this.maxLog = 500;
  }

  register(toolDef) {
    if (!toolDef.name || !toolDef.execute) {
      log.warn(`Tool invalide: ${toolDef.name || 'sans nom'}`);
      return;
    }
    this.tools.set(toolDef.name, {
      name: toolDef.name,
      description: toolDef.description || '',
      category: toolDef.category || 'general',
      agent: toolDef.agent || null,
      permission: toolDef.permission || null,
      execute: toolDef.execute,
      async: toolDef.async !== false,
      schema: toolDef.schema || null,
      metadata: toolDef.metadata || {},
      mcp: toolDef.mcp || null,
    });
    log.info(`Tool enregistré: ${toolDef.name} (${toolDef.category})`);
  }

  getTool(name) {
    return this.tools.get(name) || null;
  }

  listByAgent(agentName) {
    return Array.from(this.tools.values()).filter(t => t.agent === agentName || !t.agent);
  }

  async execute(toolName, params = {}, context = {}) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Outil '${toolName}' introuvable`);
    }

    if (tool.mcp && process.env.MCP_ENABLED === 'true') {
      try {
        const { mcpPermission } = await import('./mcp/mcp-permission.js');
        const allowed = await mcpPermission.checkToolAccess(
          tool.mcp.serverId, tool.mcp.originalName,
          context.agentName, context.jid || 'unknown'
        );
        if (!allowed) {
          throw new Error(`Permission MCP refusée: ${tool.mcp.serverId}/${tool.mcp.originalName}`);
        }
      } catch (err) {
        if (err.message.startsWith('Permission MCP')) throw err;
      }
    }

    if (tool.permission && context.agentName) {
      const permCheck = await permissionsEngine.require(context.agentName, tool.permission, context);
      if (permCheck !== true) {
        const msg = typeof permCheck === 'object' ? permCheck.message : `Permission refusée: ${tool.permission}`;
        throw new Error(msg);
      }
    }

    const start = Date.now();
    try {
      const result = await tool.execute(params, context);
      const duration = Date.now() - start;
      this._log(toolName, params, result, duration, null);
      return { success: true, result, duration };
    } catch (err) {
      const duration = Date.now() - start;
      this._log(toolName, params, null, duration, err.message);
      throw err;
    }
  }

  list(category = null, origin = null) {
    const all = Array.from(this.tools.values());
    let filtered = category ? all.filter(t => t.category === category) : all;
    if (origin === 'native') filtered = filtered.filter(t => !t.mcp);
    if (origin === 'mcp') filtered = filtered.filter(t => t.mcp);
    return filtered;
  }

  _log(toolName, params, result, duration, error) {
    const entry = {
      tool: toolName,
      params: JSON.stringify(params).slice(0, 500),
      result: result ? JSON.stringify(result).slice(0, 500) : null,
      duration,
      error,
      timestamp: Date.now(),
    };
    this.executionLog.push(entry);
    if (this.executionLog.length > this.maxLog) this.executionLog.shift();

    try {
      rawRun('INSERT INTO ainoria_tool_executions (tool, params, result, duration, error, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        toolName, entry.params, entry.result, duration, error || null, entry.timestamp);
    } catch (dbErr) {
      log.warn(`Log DB outil: ${dbErr.message}`);
    }
  }

  getRecentExecutions(limit = 20) {
    return this.executionLog.slice(-limit).reverse();
  }

  getStats() {
    const all = Array.from(this.tools.values());
    const total = all.length;
    const byCategory = {};
    let mcp = 0;
    for (const t of all) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      if (t.mcp) mcp++;
    }
    return { total, native: total - mcp, mcp, byCategory, recentExecutions: this.executionLog.length };
  }
}

export const toolEngine = new ToolEngine();
export default toolEngine;
