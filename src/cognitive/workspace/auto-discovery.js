import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';
import { api } from '../cognitive-api.js';
import { workspaceManager } from './workspace-manager.js';
import { groupFactory } from './group-agent-factory.js';

const log = createLogger('DISCOVERY');

class AutoDiscovery {
  #running = false;

  async discoverAll(sock, ownerJid) {
    if (this.#running) return;
    this.#running = true;
    log.info(`[DISCOVERY] Starting for ${ownerJid}`);

    try {
      const ws = await workspaceManager.create(ownerJid, sock.user?.name || 'User');
      const groups = await this._discoverGroups(sock, ws);
      const contacts = await this._discoverContacts(sock, ws);
      const communities = await this._discoverCommunities(sock, ws);
      const channels = await this._discoverChannels(sock, ws);

      await this._createWorkspaceContext(ws, groups, contacts, sock);

      bus.emit('discovery:complete', {
        workspaceId: ws.id, ownerJid,
        groups: groups.length, contacts: contacts.length,
        communities: communities.length, channels: channels.length,
      });

      log.info(`[DISCOVERY] Complete: ${groups.length}g ${contacts.length}c ${communities.length}com ${channels.length}ch`);
      return { groups, contacts, communities, channels };
    } catch (err) {
      log.error(`[DISCOVERY] Error: ${err.message}`);
    } finally {
      this.#running = false;
    }
  }

  async _discoverGroups(sock, ws) {
    const groups = [];
    try {
      const allGroups = await sock.groupFetchAllParticipating();
      const botJid = sock.user?.id?.replace(/:.*@/, '@');

      for (const [jid, meta] of Object.entries(allGroups)) {
        const botParticipant = meta.participants?.find(p => p.id.replace(/:.*@/, '@') === botJid);
        const isAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

        ws.addGroup(jid, { subject: meta.subject, size: meta.participants?.length || 0, isAdmin });
        groups.push({ jid, subject: meta.subject, size: meta.participants?.length, isAdmin });

        await api.act({ type: 'store_context', key: `group:${jid}`, value: { subject: meta.subject, isAdmin } }, { jid });

        if (isAdmin) {
          await api.act({ type: 'strengthen_concept', name: `group:${meta.subject}`, amount: 1 });
        }
      }
    } catch (err) {
      log.warn(`[DISCOVERY] groups error: ${err.message}`);
    }
    ws.stats.groupsDiscovered = groups.length;
    return groups;
  }

  async _discoverContacts(sock, ws) {
    const contacts = [];
    try {
      const groups = Array.from(ws.groups.values());
      const seen = new Set();

      for (const group of groups) {
        try {
          const meta = await sock.groupMetadata(group.jid);
          for (const p of meta.participants || []) {
            const jid = p.id.replace(/:.*@/, '@');
            if (seen.has(jid) || jid === ws.ownerJid) continue;
            seen.add(jid);
            ws.addContact(jid, p.name || 'Unknown');
            contacts.push({ jid, name: p.name, admin: !!p.admin });
          }
        } catch {}
      }
    } catch (err) {
      log.warn(`[DISCOVERY] contacts error: ${err.message}`);
    }
    return contacts;
  }

  async _discoverCommunities(sock, ws) {
    return [];
  }

  async _discoverChannels(sock, ws) {
    return [];
  }

  async _createWorkspaceContext(ws, groups, contacts, sock) {
    try {
      await api.act({ type: 'store_context', key: 'workspace:owner', value: ws.ownerJid }, { jid: ws.ownerJid });
      await api.act({ type: 'store_context', key: 'workspace:autonomy', value: ws.autonomy }, { jid: ws.ownerJid });
      await api.act({ type: 'store_context', key: 'workspace:groups_count', value: groups.length }, { jid: ws.ownerJid });
      await api.act({ type: 'store_context', key: 'workspace:contacts_count', value: contacts.length }, { jid: ws.ownerJid });

      for (const g of groups.slice(0, 10)) {
        await api.act({ type: 'strengthen_concept', name: `group:${g.subject}`, amount: 1 });
      }

      for (const g of groups) {
        if (g.isAdmin) {
          groupFactory.createForGroup(sock, g.jid, g.subject, ws).catch(err =>
            log.warn(`[DISCOVERY] group agent creation error: ${err.message}`)
          );
        }
      }
    } catch (err) {
      log.warn(`[DISCOVERY] context error: ${err.message}`);
    }
  }

  async onGroupAdded(sock, groupJid, ws) {
    try {
      const meta = await sock.groupMetadata(groupJid);
      ws.addGroup(groupJid, { subject: meta.subject, size: meta.participants?.length, isAdmin: true });
      await api.act({ type: 'store_context', key: `group:${groupJid}`, value: { subject: meta.subject } }, { jid: groupJid });
      groupFactory.createForGroup(sock, groupJid, meta.subject, ws).catch(() => {});
    } catch (err) {
      log.warn(`[DISCOVERY] onGroupAdded: ${err.message}`);
    }
  }
}

export const discovery = new AutoDiscovery();
export default discovery;
