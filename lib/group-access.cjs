const fs = require('fs');
const path = require('path');
const config = require('../config-djousse.cjs');

const FILE = path.join(process.cwd(), 'database', 'group_access.json');
const ADMIN_CACHE_TTL = 2 * 60 * 1000;
const WARN_COOLDOWN = 2 * 60 * 1000;
const ADMIN_ALERT_COOLDOWN = 10 * 60 * 1000;
const ATTEMPT_WINDOW = 10 * 60 * 1000;
const ALERT_THRESHOLD = 3;

const prefix = () => config.PREFIX || '.';

const adminCache = new Map();
const lastWarn = new Map();
const lastAdminAlert = new Map();
const attempts = new Map();

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { groups: {} }; }
}

function save(d) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch {}
}

function isAllowed(jid) {
  return !!load().groups[jid];
}

function accept(jid) {
  const d = load();
  d.groups[jid] = { acceptedAt: Date.now() };
  save(d);
  return true;
}

function revoke(jid) {
  const d = load();
  delete d.groups[jid];
  save(d);
  return true;
}

function status(jid) {
  const g = load().groups[jid];
  return g ? { accepted: true, acceptedAt: g.acceptedAt } : { accepted: false };
}

function ownerJid() {
  const num = config.OWNER_NUMBER || (global.__sessionOwnerNumber && global.__sessionOwnerNumber[0]) || '';
  const digits = String(num).replace(/[^0-9]/g, '');
  return digits ? digits + '@s.whatsapp.net' : '';
}

function bumpAttempt(chat, sender) {
  const now = Date.now();
  let chatMap = attempts.get(chat);
  if (!chatMap) { chatMap = new Map(); attempts.set(chat, chatMap); }
  const rec = chatMap.get(sender);
  const count = (rec && now - rec.at < ATTEMPT_WINDOW) ? rec.count + 1 : 1;
  chatMap.set(sender, { count, at: now });
  return count;
}

async function getGroupInfo(sock, chat) {
  const cached = adminCache.get(chat);
  if (cached && cached.exp > Date.now()) return cached;
  try {
    const meta = await sock.groupMetadata(chat).catch(() => null);
    if (!meta) return { admins: new Set(), subject: chat };
    const admins = new Set((meta.participants || []).filter(p => p.admin).map(p => String(p.id).split(':')[0]));
    const info = { admins, subject: meta.subject || chat, exp: Date.now() + ADMIN_CACHE_TTL };
    adminCache.set(chat, info);
    return info;
  } catch {
    return { admins: new Set(), subject: chat };
  }
}

async function isGroupAdmin(sock, chat, sender) {
  const info = await getGroupInfo(sock, chat);
  return info.admins.has(String(sender).split(':')[0]);
}

async function adminAlert(sock, m, count) {
  const info = await getGroupInfo(sock, m.chat);
  const senderNum = String(m.sender).split('@')[0];
  const label = m.pushName ? m.pushName.replace(/\s+/g, '_') : senderNum;
  const mentionJids = [m.sender, ...info.admins].filter(Boolean);
  const txt = '🔴🚨 *ALERTE SÉCURITÉ GROUPE* 🚨🔴\n\nLe membre *@' + label + '* (' + senderNum + ') a tenté d\'utiliser des commandes non autorisées (tentative n°' + count + ').\n\n👉 Membre de confiance ? Tapez *' + prefix() + 'accept*\n🔒 Sinon, surveillez-le ou bannissez-le.';
  try { await sock.sendMessage(m.chat, { text: txt, mentions: mentionJids }); } catch (e) { console.error('❌ adminAlert:', e.message); }

  const owner = ownerJid();
  if (owner && owner !== m.sender) {
    try {
      await sock.sendMessage(owner, {
        text: '🔴🚨 *ALERTE BOT — TENTATIVES RÉPÉTÉES* 🚨🔴\n\n📌 Groupe : ' + info.subject + '\n👤 Membre : ' + label + ' (' + senderNum + ')\n⚡ Tentatives : ' + count + '\n\nPour autoriser le groupe : *' + prefix() + 'accept*'
      });
    } catch (e) { console.error('❌ ownerAlert:', e.message); }
  }
}

async function check(sock, m) {
  if (isAllowed(m.chat)) return true;
  if (await isGroupAdmin(sock, m.chat, m.sender)) return true;
  await warn(sock, m);
  return false;
}

async function warn(sock, m) {
  const now = Date.now();
  const count = bumpAttempt(m.chat, m.sender);
  const pubLast = lastWarn.get(m.chat) || 0;

  if (now - pubLast >= WARN_COOLDOWN) {
    lastWarn.set(m.chat, now);
    const msg1 = '🔴🚫 *ACCÈS REFUSÉ* 🚫🔴\n\nVous n\'êtes pas autorisé à utiliser les commandes du bot.\n📞 Veuillez contacter l\'administrateur système.';
    const msg2 = '🔴⚠️ *ATTENTION* ⚠️🔴\n\n*VOUS RISQUEZ D\'ÊTRE BANNIS DU GROUPE* si vous continuez.\n\n🔒 Les commandes sont réservées aux membres autorisés uniquement.';
    try { await sock.sendMessage(m.chat, { text: msg1 }, { quoted: m }); } catch {}
    try { await sock.sendMessage(m.chat, { text: msg2 }); } catch {}

    try {
      await sock.sendMessage(m.sender, {
        text: '🔴 *DJOUSSE TECH — Commande refusée*\n\nVous avez tenté d\'utiliser une commande du bot alors que l\'accès est restreint.\n🚫 Vous n\'êtes pas autorisé(e).\n📞 Contactez l\'administrateur système pour obtenir l\'accès.\n🟡 Astuce : demandez à un admin de taper *' + prefix() + 'accept* pour autoriser tout le groupe.\n\n⚠️ Les tentatives répétées peuvent entraîner un bannissement du groupe.'
      });
    } catch {}
  }

  if (count === ALERT_THRESHOLD && now - (lastAdminAlert.get(m.chat) || 0) >= ADMIN_ALERT_COOLDOWN) {
    lastAdminAlert.set(m.chat, now);
    await adminAlert(sock, m, count);
  }
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of adminCache) if (v.exp < now) adminCache.delete(k);
  for (const [k, t] of lastWarn) if (now - t > WARN_COOLDOWN) lastWarn.delete(k);
  for (const [k, t] of lastAdminAlert) if (now - t > ADMIN_ALERT_COOLDOWN) lastAdminAlert.delete(k);
  for (const [chat, chatMap] of attempts) {
    for (const [sender, rec] of chatMap) if (now - rec.at > ATTEMPT_WINDOW) chatMap.delete(sender);
    if (chatMap.size === 0) attempts.delete(chat);
  }
}
setInterval(cleanup, 10 * 60 * 1000).unref();

module.exports = { isAllowed, accept, revoke, status, check, warn, isGroupAdmin };
