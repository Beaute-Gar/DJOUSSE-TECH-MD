'use strict';

/* Garde unique pour les permissions OWNER / ADMIN / GROUP.
   Complète lib/group-access.cjs (portail d'accès aux groupes) sans le dupliquer.
   Owner = numéro de session (global.__sessionOwnerNumber) + config-djousse BOT_OWNER
   + config.cjs OWNER_NUMBER + SUDO. */

const config = require('../config-djousse.cjs');

const SUPPORTED = { 'admin': true, 'superadmin': true };

function cleanNumber(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function ownerNumbers() {
  const list = [];
  const session = (global.__sessionOwnerNumber || '');
  if (Array.isArray(session)) list.push(...session);
  else if (session) list.push(session);
  if (config.BOT_OWNER) list.push(config.BOT_OWNER);
  try {
    const c2 = require('../config.js');
    if (c2.ownerNumber) list.push(...(Array.isArray(c2.ownerNumber) ? c2.ownerNumber : [c2.ownerNumber]));
  } catch {}
  if (Array.isArray(config.SUDO_NUMBERS)) list.push(...config.SUDO_NUMBERS);
  list.push(...String(process.env.SUDO_NUMBER || '').split(',').map(s => s.trim()).filter(Boolean));
  return [...new Set(list.map(cleanNumber).filter(Boolean))];
}

function isOwner(jid) {
  if (!jid) return false;
  const num = cleanNumber(jid);
  return ownerNumbers().includes(num);
}

async function isGroupAdmin(sock, group, jid) {
  if (!sock || !group || !jid) return false;
  try {
    const md = await sock.groupMetadata(group);
    const p = (md.participants || []).find(x => cleanNumber(x.id) === cleanNumber(jid));
    return !!p && SUPPORTED[p.admin];
  } catch { return false; }
}

async function isBotAdmin(sock, group) {
  if (!sock || !sock.user || !sock.user.id) return false;
  return isGroupAdmin(sock, group, String(sock.user.id));
}

async function isGroupOwner(sock, group, jid) {
  try {
    const md = await sock.groupMetadata(group);
    return cleanNumber(md.owner) === cleanNumber(jid);
  } catch { return false; }
}

/* Vérifie l'accès à une commande de groupe :
   owner  → toujours
   admins → si c'est un groupe
   sinon  → refus avec message. */
async function guardGroupAdmin(sock, m) {
  if (isOwner(m.sender) || isOwner(m.altSender)) return true;
  if (m.chat.endsWith('@g.us') && await isGroupAdmin(sock, m.chat, m.sender)) return true;
  try { await sock.sendMessage(m.chat, { text: '❌ Commande réservée aux admins du groupe.' }, { quoted: m }); } catch {}
  return false;
}

async function guardOwner(sock, m) {
  if (isOwner(m.sender) || isOwner(m.altSender)) return true;
  try { await sock.sendMessage(m.chat, { text: '👑 Commande réservée à l\'owner.' }, { quoted: m }); } catch {}
  return false;
}

module.exports = {
  isOwner, isGroupAdmin, isBotAdmin, isGroupOwner, guardGroupAdmin, guardOwner, cleanNumber,
};