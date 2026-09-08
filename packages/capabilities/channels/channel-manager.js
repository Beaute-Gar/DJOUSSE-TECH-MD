import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('CHANNELS');

export class ChannelManager {
  constructor(sock) {
    this.sock = sock;
    this._initDB();
  }

  _initDB() {
    rawRun(`CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      owner_jid TEXT NOT NULL, created_at INTEGER NOT NULL,
      is_public INTEGER DEFAULT 1, members_count INTEGER DEFAULT 0,
      last_activity INTEGER NOT NULL
    )`);
    rawRun(`CREATE TABLE IF NOT EXISTS channel_subscribers (
      channel_id TEXT NOT NULL, subscriber_jid TEXT NOT NULL,
      subscribed_at INTEGER NOT NULL, is_admin INTEGER DEFAULT 0,
      PRIMARY KEY (channel_id, subscriber_jid)
    )`);
    rawRun(`CREATE TABLE IF NOT EXISTS channel_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT NOT NULL,
      content TEXT NOT NULL, author_jid TEXT NOT NULL,
      posted_at INTEGER NOT NULL, media_type TEXT,
      media_url TEXT
    )`);
  }

  createChannel(name, description, ownerJid, isPublic = true) {
    const id = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    rawRun('INSERT INTO channels (id, name, description, owner_jid, created_at, is_public, members_count, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, description, ownerJid, Date.now(), isPublic ? 1 : 0, 1, Date.now());
    rawRun('INSERT INTO channel_subscribers (channel_id, subscriber_jid, subscribed_at, is_admin) VALUES (?, ?, ?, 1)',
      id, ownerJid, Date.now());
    log.info(`Chaîne créée: ${name} (${id}) par ${ownerJid}`);
    return { id, name, ownerJid };
  }

  subscribe(channelId, subscriberJid) {
    const ch = rawGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!ch) return { success: false, message: 'Chaîne introuvable' };
    if (ch.is_public === 0) {
      return { success: false, message: 'Chaîne privée — seuls les admins peuvent ajouter' };
    }
    try {
      rawRun('INSERT OR IGNORE INTO channel_subscribers (channel_id, subscriber_jid, subscribed_at, is_admin) VALUES (?, ?, ?, 0)',
        channelId, subscriberJid, Date.now());
      rawRun('UPDATE channels SET members_count = (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = ?), last_activity = ? WHERE id = ?',
        channelId, Date.now(), channelId);
      return { success: true, message: `Abonné à "${ch.name}"` };
    } catch (e) { return { success: false, message: e.message }; }
  }

  unsubscribe(channelId, subscriberJid) {
    rawRun('DELETE FROM channel_subscribers WHERE channel_id = ? AND subscriber_jid = ?', channelId, subscriberJid);
    rawRun('UPDATE channels SET members_count = (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = ?), last_activity = ? WHERE id = ?',
      channelId, Date.now(), channelId);
    return { success: true, message: 'Désabonné de la chaîne' };
  }

  async broadcast(channelId, content, authorJid, mediaType = null, mediaUrl = null) {
    const ch = rawGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!ch) return { success: false, message: 'Chaîne introuvable' };
    const isAdmin = rawGet('SELECT * FROM channel_subscribers WHERE channel_id = ? AND subscriber_jid = ? AND is_admin = 1',
      channelId, authorJid);
    if (!isAdmin) return { success: false, message: 'Seuls les admins peuvent publier' };
    rawRun('INSERT INTO channel_posts (channel_id, content, author_jid, posted_at, media_type, media_url) VALUES (?, ?, ?, ?, ?, ?)',
      channelId, content, authorJid, Date.now(), mediaType, mediaUrl);
    rawRun('UPDATE channels SET last_activity = ? WHERE id = ?', Date.now(), channelId);
    const subscribers = rawAll('SELECT subscriber_jid FROM channel_subscribers WHERE channel_id = ?', channelId);
    let sent = 0;
    for (const sub of subscribers) {
      try {
        if (mediaType === 'image' && mediaUrl) {
          await this.sock.sendMessage(sub.subscriber_jid, { image: { url: mediaUrl }, caption: content });
        } else if (mediaType === 'video' && mediaUrl) {
          await this.sock.sendMessage(sub.subscriber_jid, { video: { url: mediaUrl }, caption: content });
        } else {
          await this.sock.sendMessage(sub.subscriber_jid, { text: `📢 *${ch.name}*\n\n${content}` });
        }
        sent++;
      } catch (e) { log.warn(`broadcast to ${sub.subscriber_jid}: ${e.message}`); }
    }
    log.info(`Chaîne "${ch.name}": broadcast à ${sent}/${subscribers.length} abonnés`);
    return { success: true, sent, total: subscribers.length };
  }

  getChannel(channelId) {
    const ch = rawGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!ch) return null;
    ch.subscribers = rawAll('SELECT subscriber_jid, subscribed_at, is_admin FROM channel_subscribers WHERE channel_id = ? ORDER BY subscribed_at', channelId);
    ch.posts = rawAll('SELECT * FROM channel_posts WHERE channel_id = ? ORDER BY posted_at DESC LIMIT 20', channelId);
    return ch;
  }

  listChannels(publicOnly = true) {
    if (publicOnly) return rawAll('SELECT * FROM channels WHERE is_public = 1 ORDER BY members_count DESC, last_activity DESC LIMIT 50');
    return rawAll('SELECT * FROM channels ORDER BY last_activity DESC LIMIT 50');
  }

  listUserChannels(jid) {
    return rawAll(`SELECT c.* FROM channels c JOIN channel_subscribers s ON c.id = s.channel_id WHERE s.subscriber_jid = ? ORDER BY c.last_activity DESC`, jid);
  }

  listUserAdminChannels(jid) {
    return rawAll(`SELECT c.* FROM channels c JOIN channel_subscribers s ON c.id = s.channel_id WHERE s.subscriber_jid = ? AND s.is_admin = 1 ORDER BY c.last_activity DESC`, jid);
  }

  deleteChannel(channelId, adminJid) {
    const ch = rawGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!ch) return { success: false, message: 'Chaîne introuvable' };
    const isAdmin = rawGet('SELECT * FROM channel_subscribers WHERE channel_id = ? AND subscriber_jid = ? AND is_admin = 1', channelId, adminJid);
    if (!isAdmin && ch.owner_jid !== adminJid) return { success: false, message: 'Seul le propriétaire peut supprimer' };
    rawRun('DELETE FROM channel_posts WHERE channel_id = ?', channelId);
    rawRun('DELETE FROM channel_subscribers WHERE channel_id = ?', channelId);
    rawRun('DELETE FROM channels WHERE id = ?', channelId);
    log.info(`Chaîne supprimée: ${ch.name}`);
    return { success: true, message: `Chaîne "${ch.name}" supprimée` };
  }

  addChannelAdmin(channelId, adminJid, newAdminJid) {
    const isAdmin = rawGet('SELECT * FROM channel_subscribers WHERE channel_id = ? AND subscriber_jid = ? AND is_admin = 1', channelId, adminJid);
    if (!isAdmin) return { success: false, message: 'Permission refusée' };
    rawRun('INSERT OR REPLACE INTO channel_subscribers (channel_id, subscriber_jid, subscribed_at, is_admin) VALUES (?, ?, ?, 1)',
      channelId, newAdminJid, Date.now());
    return { success: true, message: 'Admin ajouté à la chaîne' };
  }

  searchChannels(query) {
    const q = `%${query}%`;
    return rawAll('SELECT * FROM channels WHERE is_public = 1 AND (name LIKE ? OR description LIKE ?) ORDER BY members_count DESC LIMIT 20', q, q);
  }
}
