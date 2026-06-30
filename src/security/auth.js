import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');

const OWNER_JID = config.OWNER_NUMBER
  ? config.OWNER_NUMBER.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  : null;

const SUDO_JIDS = new Set(
  config.SUDO_NUMBERS.map(n => n.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
);

const knownOwnerJids = new Set();

export const LEVELS = { owner: 3, sudo: 2, premium: 2, user: 1 };
export const LEVEL = { OWNER: 3, SUDO: 2, PREMIUM: 2, USER: 1 };

export function getPrivilege(jid) {
  if (!jid) return 'user';
  const normalized = jid.split(':')[0];
  if (OWNER_JID && normalized === OWNER_JID) return 'owner';
  if (knownOwnerJids.has(normalized)) return 'owner';
  if (SUDO_JIDS.has(normalized)) return 'sudo';
  if (checkDbSudo(normalized)) return 'sudo';
  return 'user';
}

function checkDbSudo(jid) {
  try {
    const { Sudo } = require('../lib/database.js');
    return Sudo.isSudo(jid);
  } catch { return false; }
}

export function getAuthLevel(jid) {
  return LEVELS[getPrivilege(jid)] || 1;
}

export function hasAccess(jid, required = 'user') {
  const userLevel = getPrivilege(jid);
  const userRank = LEVELS[userLevel] ?? 1;
  const requiredRank = LEVELS[required] ?? 1;
  return userRank >= requiredRank;
}

export function isModeAllowed(m) {
  const mode = (config.MODE || 'public').toLowerCase();
  if (mode === 'public') return true;
  if (mode === 'private') return hasAccess(m.sender, 'sudo');
  if (mode === 'group') return m.isGroup === true;
  return true;
}

export function isGroupAllowed(groupJid) {
  if (!config.WHITELIST_GROUPS || config.WHITELIST_GROUPS.length === 0) return true;
  return config.WHITELIST_GROUPS.includes(groupJid);
}

export function isOwner(jid) {
  return getPrivilege(jid) === 'owner';
}

export function isSudo(jid) {
  return getPrivilege(jid) === 'sudo' || getPrivilege(jid) === 'owner';
}

export function isPremium(jid) {
  try {
    const { Users } = require('../lib/database.js');
    const u = Users.get(jid);
    return u?.is_premium === 1;
  } catch { return false; }
}

export function registerOwnerJid(jid) {
  const cleaned = jid.replace(/[^0-9@.\-_]/g, '');
  knownOwnerJids.add(cleaned);
}

export function getOwnerJids() {
  const jids = [];
  if (OWNER_JID) jids.push(OWNER_JID);
  for (const j of knownOwnerJids) jids.push(j);
  return jids;
}

export function requireAuthLevel(jid, level) {
  return getAuthLevel(jid) >= LEVELS[level];
}

export function addSudoRuntime(jid) {
  SUDO_JIDS.add(jid.replace(/[^0-9@.]/g, ''));
}

export function removeSudoRuntime(jid) {
  SUDO_JIDS.delete(jid.replace(/[^0-9@.]/g, ''));
}

export function reloadAuth() {
  knownOwnerJids.clear();
}

export async function checkPermission(jid, meta, opts = {}) {
  const level = meta?.level || 'user';
  const has = hasAccess(jid, level);
  if (!has) return { allowed: false, reason: `LEVEL_REQUIRED:${level}` };
  if (opts.isGroup && meta?.groupOnly && !opts.isGroup) return { allowed: false, reason: 'GROUP_ONLY' };
  if (opts.isGroup && meta?.adminOnly && !opts.isGroupAdmin) return { allowed: false, reason: 'ADMIN_ONLY' };
  if (meta?.ownerOnly && !isOwner(jid)) return { allowed: false, reason: 'OWNER_ONLY' };
  return { allowed: true };
}

export function denyMessage(reason = 'ACCESS_DENIED') {
  const messages = {
    'LEVEL_REQUIRED:owner': '🚫 Commande réservée au propriétaire.',
    'LEVEL_REQUIRED:sudo':  '🚫 Commande réservée aux admins du bot.',
    'LEVEL_REQUIRED:premium': '⭐ Commande réservée aux membres Premium.',
    'GROUP_ONLY':   '👥 Cette commande ne fonctionne qu\'en groupe.',
    'ADMIN_ONLY':   '👑 Cette commande nécessite les droits d\'admin du groupe.',
    'OWNER_ONLY':   '🚫 Seul le propriétaire peut faire ça.',
  };
  return messages[reason] || '🚫 Accès refusé.';
}
