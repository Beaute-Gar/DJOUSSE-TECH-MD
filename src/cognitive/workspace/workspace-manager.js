import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';
import { api } from '../cognitive-api.js';
import { orchestrator } from '../agents/agent-framework.js';
import { trust } from '../governance/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const log = createLogger('WORKSPACE');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../../data/workspaces.json');

export class Workspace {
  constructor(id, ownerJid, ownerName) {
    this.id = id;
    this.ownerJid = ownerJid;
    this.ownerName = ownerName || ownerJid;
    this.createdAt = Date.now();
    this.lastActive = Date.now();
    this.groups = new Map();
    this.contacts = new Map();
    this.autonomy = 'assisted';
    this.stats = { messagesProcessed: 0, missionsCreated: 0, groupsDiscovered: 0, agentsActive: 0 };
    this.status = 'active';
  }

  addGroup(jid, metadata) {
    this.groups.set(jid, { jid, ...metadata, addedAt: Date.now(), lastActive: Date.now() });
    this.stats.groupsDiscovered = this.groups.size;
  }

  removeGroup(jid) {
    this.groups.delete(jid);
  }

  getGroup(jid) {
    return this.groups.get(jid);
  }

  addContact(jid, name) {
    this.contacts.set(jid, { jid, name, addedAt: Date.now(), interactions: 0 });
  }

  getStats() {
    return {
      ...this.stats,
      groupsTotal: this.groups.size,
      contactsTotal: this.contacts.size,
      autonomy: this.autonomy,
      uptime: Date.now() - this.createdAt,
    };
  }

  toJSON() {
    return {
      id: this.id, ownerJid: this.ownerJid, ownerName: this.ownerName,
      createdAt: this.createdAt, lastActive: this.lastActive,
      autonomy: this.autonomy, status: this.status,
      stats: this.stats,
      groups: Array.from(this.groups.entries()).map(([k, v]) => ({ jid: k, ...v })),
      contacts: Array.from(this.contacts.entries()).map(([k, v]) => ({ jid: k, ...v })),
    };
  }
}

export class WorkspaceManager {
  #workspaces = new Map();
  #storePath = STORE_PATH;

  constructor() {
    this._load();
    bus.on('connection:open', this._onConnect.bind(this));
  }

  async create(ownerJid, ownerName) {
    if (this.#workspaces.has(ownerJid)) return this.#workspaces.get(ownerJid);
    const ws = new Workspace(`ws_${Date.now()}`, ownerJid, ownerName);
    this.#workspaces.set(ownerJid, ws);
    this._save();
    trust.register(`workspace:${ws.id}`);
    bus.emit('workspace:created', { workspaceId: ws.id, ownerJid });
    log.info(`[WORKSPACE] created for ${ownerJid}`);
    return ws;
  }

  get(ownerJid) {
    return this.#workspaces.get(ownerJid);
  }

  getById(id) {
    for (const ws of this.#workspaces.values()) {
      if (ws.id === id) return ws;
    }
    return null;
  }

  getByJid(jid) {
    for (const ws of this.#workspaces.values()) {
      if (ws.ownerJid === jid) return ws;
      for (const [gJid] of ws.groups) {
        if (gJid === jid) return ws;
      }
    }
    return null;
  }

  list() {
    return Array.from(this.#workspaces.values()).map(ws => ({
      id: ws.id, owner: ws.ownerName || ws.ownerJid, autonomy: ws.autonomy,
      groups: ws.groups.size, contacts: ws.contacts.size, status: ws.status,
      created: ws.createdAt,
    }));
  }

  async delete(ownerJid) {
    const ws = this.#workspaces.get(ownerJid);
    if (!ws) return false;
    bus.emit('workspace:deleted', { workspaceId: ws.id, ownerJid });
    this.#workspaces.delete(ownerJid);
    this._save();
    return true;
  }

  setAutonomy(ownerJid, level) {
    const ws = this.#workspaces.get(ownerJid);
    if (!ws) return false;
    if (!['observation', 'suggestion', 'assisted', 'autonomous'].includes(level)) return false;
    ws.autonomy = level;
    this._save();
    bus.emit('workspace:autonomy', { workspaceId: ws.id, level });
    return true;
  }

  touch(ownerJid) {
    const ws = this.#workspaces.get(ownerJid);
    if (ws) ws.lastActive = Date.now();
  }

  async _onConnect(data) {
    const jid = data.jid || data;
    if (!jid || this.#workspaces.has(jid)) return;
    await this.create(jid, data.name || 'User');
  }

  _save() {
    try {
      const dir = path.dirname(this.#storePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = Array.from(this.#workspaces.entries()).map(([k, v]) => ({ key: k, workspace: v.toJSON() }));
      fs.writeFileSync(this.#storePath, JSON.stringify(data, null, 2));
    } catch (err) {
      log.error(`[WORKSPACE] save error: ${err.message}`);
    }
  }

  _load() {
    try {
      if (!fs.existsSync(this.#storePath)) return;
      const raw = fs.readFileSync(this.#storePath, 'utf-8');
      const data = JSON.parse(raw);
      for (const { key, workspace } of data) {
        const ws = new Workspace(workspace.id, workspace.ownerJid, workspace.ownerName);
        ws.createdAt = workspace.createdAt;
        ws.lastActive = workspace.lastActive;
        ws.autonomy = workspace.autonomy || 'assisted';
        ws.status = workspace.status || 'active';
        ws.stats = workspace.stats || { messagesProcessed: 0, missionsCreated: 0, groupsDiscovered: 0, agentsActive: 0 };
        if (workspace.groups) for (const g of workspace.groups) ws.groups.set(g.jid, g);
        if (workspace.contacts) for (const c of workspace.contacts) ws.contacts.set(c.jid, c);
        this.#workspaces.set(key, ws);
      }
      log.info(`[WORKSPACE] loaded ${this.#workspaces.size} workspaces`);
    } catch (err) {
      log.error(`[WORKSPACE] load error: ${err.message}`);
    }
  }
}

export const workspaceManager = new WorkspaceManager();
export default workspaceManager;
