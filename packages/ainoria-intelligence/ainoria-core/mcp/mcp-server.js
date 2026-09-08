import { createLogger } from '../../../infrastructure/logger.js';
import { toolEngine } from '../tool-engine.js';

const log = createLogger('MCP-SERVER');

export class McpServer {
  constructor() {
    this._running = false;
    this._tools = [];
    this._handler = null;
  }

  isRunning() { return this._running; }

  async start() {
    if (this._running) return;
    this._running = true;
    this._handler = this._createHandler();
    log.info('Serveur MCP intégré prêt (stdio)');
  }

  async stop() {
    this._running = false;
    this._handler = null;
    log.info('Serveur MCP intégré arrêté');
  }

  async registerTools(tools = []) {
    this._tools = tools.map(t => this._toMCPDefinition(t));
  }

  _createHandler() {
    if (typeof process !== 'undefined' && process.stdin) {
      let buffer = '';
      process.stdin.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          this._handleRequest(line.trim()).catch(() => {});
        }
      });
      log.info('Handler MCP stdio actif');
    }
    return { handle: (req) => this._handleRequest(req) };
  }

  async _handleRequest(raw) {
    try {
      const request = JSON.parse(raw);
      const response = { jsonrpc: '2.0', id: request.id };

      switch (request.method) {
        case 'tools/list':
          response.result = { tools: this._tools };
          break;

        case 'tools/call':
          response.result = await this._executeTool(request.params);
          break;

        case 'resources/list':
          response.result = { resources: [] };
          break;

        case 'ping':
          response.result = { status: 'ok' };
          break;

        default:
          response.error = { code: -32601, message: `Méthode non supportée: ${request.method}` };
      }

      this._sendResponse(response);
    } catch (err) {
      log.error(`Erreur handler MCP: ${err.message}`);
    }
  }

  async _executeTool(params) {
    const name = params?.name;
    const args = params?.arguments || {};

    if (!name) {
      return { content: [{ type: 'text', text: 'Nom d\'outil requis' }], isError: true };
    }

    const cleanName = name.replace(/^mcp:/, '');
    const tool = toolEngine.getTool(cleanName);
    if (!tool) {
      return { content: [{ type: 'text', text: `Outil inconnu: ${name}` }], isError: true };
    }

    try {
      const result = await toolEngine.execute(cleanName, args, { origin: 'mcp_server' });
      return {
        content: [{ type: 'text', text: JSON.stringify(result.result) }],
        isError: false,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: err.message }],
        isError: true,
      };
    }
  }

  _sendResponse(response) {
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  }

  _toMCPDefinition(ainoriaTool) {
    const properties = {};
    if (ainoriaTool.schema?.properties) {
      for (const [key, val] of Object.entries(ainoriaTool.schema.properties)) {
        properties[key] = {
          type: val.type || 'string',
          description: val.description || '',
        };
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

  listCapabilities() {
    return {
      tools: this._tools.length,
      running: this._running,
      methods: ['tools/list', 'tools/call', 'resources/list', 'ping'],
    };
  }
}

export const mcpServer = new McpServer();
