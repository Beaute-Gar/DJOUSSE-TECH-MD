import { spawn } from 'child_process';
import { createLogger } from '../../../infrastructure/logger.js';
import { rawGet, rawRun } from '../../../infrastructure/database/database.js';

const log = createLogger('MCP-CLIENT');

let _reqId = 0;
function nextId() { return `mcp_req_${++_reqId}_${Date.now()}`; }

export class McpClient {
  constructor(config = {}) {
    this.id = config.id;
    this.name = config.name;
    this.transport = config.transport || 'stdio';
    this.command = config.command;
    this.args = config.args || [];
    this.url = config.url;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
    this._process = null;
    this._pending = new Map();
    this._buffer = '';
    this._connected = false;
    this._reconnectAttempts = 0;
    this._maxReconnect = config.maxReconnect || 3;
    this._reconnectDelay = 1000;
    this._tools = [];
    this.stats = { calls: 0, errors: 0, totalTime: 0 };
  }

  isConnected() { return this._connected; }

  async connect() {
    if (this._connected) return true;
    try {
      if (this.transport === 'stdio' && this.command) {
        await this._connectStdio();
      } else if (this.transport === 'http' && this.url) {
        await this._connectHTTP();
      } else if (this.transport === 'sse' && this.url) {
        await this._connectSSE();
      } else {
        throw new Error(`Transport MCP non supporté: ${this.transport}`);
      }
      this._connected = true;
      this._reconnectAttempts = 0;
      this._tools = await this.listTools();
      log.info(`MCP serveur connecté: ${this.name} (${this.transport}) — ${this._tools.length} outils`);
      return true;
    } catch (err) {
      log.error(`Échec connexion MCP ${this.name}: ${err.message}`);
      if (this._reconnectAttempts < this._maxReconnect) {
        this._reconnectAttempts++;
        const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);
        log.info(`Tentative reconnexion ${this._reconnectAttempts}/${this._maxReconnect} dans ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this.connect();
      }
      throw err;
    }
  }

  async _connectStdio() {
    return new Promise((resolve, reject) => {
      try {
        this._process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        this._process.stdout.on('data', (data) => {
          this._buffer += data.toString();
          this._processBuffer();
        });

        this._process.stderr.on('data', (data) => {
          log.debug(`MCP ${this.name} stderr: ${data.toString().trim()}`);
        });

        this._process.on('error', (err) => {
          log.error(`MCP ${this.name} process error: ${err.message}`);
          this._connected = false;
          reject(err);
        });

        this._process.on('close', (code) => {
          log.warn(`MCP ${this.name} process fermé (code ${code})`);
          this._connected = false;
        });

        setTimeout(() => resolve(), 500);
      } catch (err) {
        reject(err);
      }
    });
  }

  async _connectHTTP() {
    const { default: axios } = await import('axios');
    try {
      await axios.post(`${this.url}/ping`, {}, {
        timeout: 5000,
        headers: this.headers,
      });
    } catch {
      // ping may not be supported, proceed
    }
  }

  async _connectSSE() {
    const { default: EventSource } = await import('eventsource');
    this._eventSource = new EventSource(this.url);
    this._eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const pending = this._pending.get(msg.id);
        if (pending) {
          pending.resolve(msg);
          this._pending.delete(msg.id);
        }
      } catch {}
    };
    this._eventSource.onerror = () => {
      this._connected = false;
    };
  }

  _processBuffer() {
    let idx;
    while ((idx = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, idx).trim();
      this._buffer = this._buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        const pending = this._pending.get(msg.id);
        if (pending) {
          pending.resolve(msg);
          this._pending.delete(msg.id);
        }
      } catch {}
    }
  }

  _send(data) {
    if (this.transport === 'stdio' && this._process) {
      this._process.stdin.write(JSON.stringify(data) + '\n');
    } else if (this.transport === 'http' && this.url) {
      return this._sendHTTP(data);
    }
  }

  async _sendHTTP(data) {
    const { default: axios } = await import('axios');
    const res = await axios.post(this.url, data, {
      timeout: this.timeout,
      headers: { 'Content-Type': 'application/json', ...this.headers },
    });
    return res.data;
  }

  async _rpc(method, params = {}) {
    const id = nextId();
    const request = { jsonrpc: '2.0', id, method, params };

    const start = Date.now();
    this.stats.calls++;

    if (this.transport === 'http') {
      const response = await this._sendHTTP(request);
      if (response.error) throw new Error(response.error.message || 'Erreur MCP');
      this.stats.totalTime += Date.now() - start;
      return response.result;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        this.stats.errors++;
        reject(new Error(`Timeout MCP ${method} après ${this.timeout}ms`));
      }, this.timeout);

      this._pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          if (msg.error) {
            this.stats.errors++;
            reject(new Error(msg.error.message || 'Erreur MCP'));
          } else {
            this.stats.totalTime += Date.now() - start;
            resolve(msg.result);
          }
        },
        reject: (err) => {
          clearTimeout(timer);
          this.stats.errors++;
          reject(err);
        },
      });

      this._send(request);
    });
  }

  async listTools() {
    try {
      const result = await this._rpc('tools/list');
      this._tools = result?.tools || result || [];
      return this._tools;
    } catch (err) {
      log.warn(`MCP ${this.name}: liste outils échouée: ${err.message}`);
      return [];
    }
  }

  async callTool(name, params = {}) {
    return this._rpc('tools/call', { name, arguments: params });
  }

  async listResources() {
    try {
      const result = await this._rpc('resources/list');
      return result?.resources || result || [];
    } catch {
      return [];
    }
  }

  async readResource(uri) {
    return this._rpc('resources/read', { uri });
  }

  async ping() {
    try {
      await this._rpc('ping');
      return true;
    } catch {
      return false;
    }
  }

  async disconnect() {
    try {
      if (this._process) {
        this._process.stdin.end();
        this._process.kill();
        this._process = null;
      }
      if (this._eventSource) {
        this._eventSource.close();
        this._eventSource = null;
      }
      for (const [, pending] of this._pending) {
        pending.reject(new Error('Déconnexion MCP'));
      }
      this._pending.clear();
      this._connected = false;
      this._tools = [];
      log.info(`MCP serveur déconnecté: ${this.name}`);
    } catch (err) {
      log.error(`Erreur déconnexion MCP ${this.name}: ${err.message}`);
    }
  }

  getStats() {
    return {
      ...this.stats,
      connected: this._connected,
      toolsCount: this._tools.length,
      avgTime: this.stats.calls > 0 ? (this.stats.totalTime / this.stats.calls).toFixed(0) : 0,
    };
  }
}
