import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('PERSONALIZER');

let initialized = false;

export function initTracker() {
  if (initialized) return;
  rawRun(`CREATE TABLE IF NOT EXISTS chat_tracker (
    jid TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    total_messages INTEGER DEFAULT 0,
    is_group INTEGER DEFAULT 0,
    first_seen INTEGER,
    last_seen INTEGER
  )`);
  initialized = true;
}

export function trackMessage(jid, pushName, text, isGroup) {
  if (!jid || jid === 'status@broadcast') return;
  try {
    const now = Date.now();
    const existing = rawGet('SELECT total_messages FROM chat_tracker WHERE jid = ?', jid);
    if (existing) {
      rawRun("UPDATE chat_tracker SET total_messages = total_messages + 1, last_seen = ?, name = COALESCE(NULLIF(?, ''), name) WHERE jid = ?", now, pushName || '', jid);
    } else {
      rawRun('INSERT OR IGNORE INTO chat_tracker (jid, name, total_messages, is_group, first_seen, last_seen) VALUES (?, ?, 1, ?, ?, ?)', jid, pushName || '', isGroup ? 1 : 0, now, now);
    }
  } catch {}
}

export function setChatName(jid, name) {
  if (jid && name) {
    try { rawRun('UPDATE chat_tracker SET name = ? WHERE jid = ?', name, jid); } catch {}
  }
}

export async function collectRichStats(sock) {
  initTracker();
  let allGroups = [];
  try {
    const raw = await sock.groupFetchAllParticipating();
    allGroups = Object.values(raw || {});
  } catch {}
  if (allGroups.length === 0) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const raw = await sock.groupFetchAllParticipating();
      allGroups = Object.values(raw || {});
    } catch {}
  }
  const communities = allGroups.filter(g => g.isCommunity === true);
  const groups = allGroups.filter(g => !g.isCommunity);

  for (const g of groups) {
    setChatName(g.id, g.subject);
  }
  for (const c of communities) {
    setChatName(c.id, c.subject);
  }

  const groupNames = groups
    .sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0))
    .slice(0, 10)
    .map(g => ({ name: g.subject || 'Sans nom', members: g.participants?.length || 0 }));

  const communityNames = communities.map(c => ({ name: c.subject || 'Sans nom' }));

  const topChats = rawAll('SELECT jid, name, total_messages, last_seen FROM chat_tracker WHERE is_group = 0 ORDER BY total_messages DESC LIMIT 5') || [];
  const topGroupChats = rawAll('SELECT jid, name, total_messages FROM chat_tracker WHERE is_group = 1 ORDER BY total_messages DESC LIMIT 5') || [];

  let topPrivateName = null;
  let topPrivateMsgs = 0;
  if (topChats.length > 0) {
    topPrivateName = topChats[0].name || topChats[0].jid.split('@')[0];
    topPrivateMsgs = topChats[0].total_messages;
  }

  const totalTracked = rawGet('SELECT COUNT(*) as n FROM chat_tracker');
  const totalTrackedPrivate = rawGet("SELECT COUNT(*) as n FROM chat_tracker WHERE is_group = 0 AND jid NOT LIKE '%@broadcast'");

  const memberCount = new Set();
  for (const g of groups) {
    for (const p of (g.participants || [])) memberCount.add(p.id);
  }

  const result = {
    totalGroups: groups.length,
    totalCommunities: communities.length,
    totalPrivateChats: totalTrackedPrivate?.n || 0,
    totalContacts: memberCount.size,
    topGroups: groupNames.slice(0, 3).map(g => g.name),
    topCommunities: communityNames.slice(0, 3).map(c => c.name),
    topPrivateName,
    topPrivateMsgs,
    topGroupName: topGroupChats[0]?.name || groupNames[0]?.name || null,
    topGroupMsgs: topGroupChats[0]?.total_messages || 0,
    allGroupNames: groupNames.slice(0, 5).map(g => g.name),
    allCommunityNames: communityNames.slice(0, 5).map(c => c.name),
    topPrivateChats: topChats.map(c => ({ name: c.name || c.jid.split('@')[0], msgs: c.total_messages })),
  };

  log.info(`Analyse: ${result.totalGroups}g/${result.totalCommunities}c/${result.totalPrivateChats}p · top privé: ${result.topPrivateName} (${result.topPrivateMsgs} msgs)`);
  return result;
}

export default { initTracker, trackMessage, setChatName, collectRichStats };
