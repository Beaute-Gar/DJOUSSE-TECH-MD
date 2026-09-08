import { createLogger } from '../../../infrastructure/logger.js';
import { toolEngine } from '../tool-engine.js';

const log = createLogger('MCP-TOOL-ADAPTER');

export class McpToolAdapter {
  constructor() {
    this._mcpTools = new Map();
    this.stats = { registered: 0, unregistered: 0, calls: 0, errors: 0 };
  }

  async registerMCPTool(serverId, mcpToolDef) {
    const toolName = `mcp:${serverId}:${mcpToolDef.name}`;
    const existing = toolEngine.getTool(toolName);
    if (existing) return existing;

    const ainoriaTool = {
      name: toolName,
      description: mcpToolDef.description || `Outil MCP: ${mcpToolDef.name}`,
      category: 'mcp',
      permission: `mcp.${serverId}.${mcpToolDef.name}`,
      mcp: {
        serverId,
        originalName: mcpToolDef.name,
        schema: mcpToolDef.inputSchema || null,
      },
      execute: async (params, context) => {
        this.stats.calls++;
        const { mcpManager } = await import('./mcp-manager.js');
        try {
          const result = await mcpManager.callTool(serverId, mcpToolDef.name, params);
          return result;
        } catch (err) {
          this.stats.errors++;
          throw err;
        }
      },
    };

    toolEngine.register(ainoriaTool);
    this._mcpTools.set(toolName, { serverId, originalName: mcpToolDef.name });
    this.stats.registered++;
    log.info(`Outil MCP enregistré: ${toolName}`);
    return ainoriaTool;
  }

  async registerServerTools(serverId, tools) {
    const registered = [];
    for (const tool of tools) {
      try {
        const r = await this.registerMCPTool(serverId, tool);
        registered.push(r);
      } catch (err) {
        log.warn(`Échec enregistrement outil MCP ${tool.name}: ${err.message}`);
      }
    }
    return registered;
  }

  async unregisterServerTools(serverId) {
    const toRemove = [];
    for (const [toolName, info] of this._mcpTools) {
      if (info.serverId === serverId) toRemove.push(toolName);
    }
    for (const name of toRemove) {
      this._mcpTools.delete(name);
      this.stats.unregistered++;
    }
    log.info(`${toRemove.length} outils MCP retirés pour ${serverId}`);
  }

  toMCPDefinition(ainoriaTool) {
    const properties = {};
    if (ainoriaTool.schema && ainiaTool.schema.properties) {
      for (const [key, val] of Object.entries(ainoriaTool.schema.properties)) {
        properties[key] = { type: val.type || 'string', description: val.description || '' };
      }
    }
    return {
      name: ainiaTool.name,
      description: ainiaTool.description || '',
      inputSchema: {
        type: 'object',
        properties,
        required: ainiaTool.schema?.required || [],
      },
    };
  }

  isMCPTool(toolName) {
    return toolName.startsWith('mcp:');
  }

  listMCPTools() {
    return Array.from(this._mcpTools.entries()).map(([name, info]) => ({
      name,
      serverId: info.serverId,
      originalName: info.originalName,
    }));
  }

  getToolsForServer(serverId) {
    return Array.from(this._mcpTools.entries())
      .filter(([, info]) => info.serverId === serverId)
      .map(([name]) => name);
  }

  getStats() {
    return { ...this.stats, active: this._mcpTools.size };
  }
}

export const mcpToolAdapter = new McpToolAdapter();
