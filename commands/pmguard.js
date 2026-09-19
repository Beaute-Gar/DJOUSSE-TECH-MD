'use strict';
/**
 * PMGuard — protection automatique des discussions privées (Baileys + cmd())
 * Fichier : plugins/pmguard.js
 *
 * Principe : le bot ne réagit QU'AUX COMMANDES et n'écrit jamais en premier.
 *  • Mode PRIVÉ  : seul le propriétaire peut utiliser le bot (les autres : silence,
 *                  sauf un avis poli, une fois par jour, s'ils tentent une commande).
 *  • Mode PUBLIC : tout le monde peut lancer des commandes ; anti-abus automatique.
 *
 * INTÉGRATION (obligatoire, une ligne) — dans votre gestionnaire principal de messages,
 * AVANT de chercher/exécuter la commande :
 *
 *     const { pmGate } = require('./plugins/pmguard');
 *     if (!(await pmGate(conn, mek, isOwner))) return;   // false = message à ignorer
 *
 * pmGate renvoie toujours true pour les groupes : vous pouvez l'appeler pour tous les messages.
 */
const fs = require('fs');
const path = require('path');
const { cmd } = require('./command.cjs');
const { box } = require('./lib/djousse-ui.cjs');

// ════════════════════════ Configuration ════════════════════════
// Numéros propriétaires, sans "+" (ex. 2376XXXXXXXX), séparés par des virgules
const OWNERS = (process.env.OWNER_NUMBER || '237693978044').split(',').map(s => s.trim()).filter(Boolean);
// Préfixe(s) de commande, séparés par des virgules (ex. ".,!")
const PREFIXES = (process.env.PREFIX || '.').split(',').map(s => s.trim()).filter(Boolean);

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pmguard.json');

// Réglages par défaut, modifiables avec  .pm set <clé> <valeur>
const CFG = {
  floodMax: 8,            // plus de X messages ...
  floodWindowSec: 10,     // ... en Y secondes = flood
  cmdCooldownSec: 3,      // délai minimum entre deux commandes d'un même utilisateur
  maxTextLength: 4000,    // message plus long = ignoré (anti-bug)
  maxPayloadBytes: 60000, // message sérialisé plus gros = ignoré (anti-bug)
  ignoreMinutes: 10,      // durée d'ignorance au 2e avertissement
  strikeExpireDays: 7,    // les avertissements expirent après X jours
  maxBlocksPerDay: 10,    // au-delà : ignorance 24 h au lieu d'un blocage
  callsBeforeBlock: 3,    // appels en 24 h avant blocage
  dailyQuota: 0,          // commandes/jour/utilisateur (0 = illimité)
};

// ════════════════════════ Stockage (JSON, écriture atomique) ════════════════════════
let db = {
  mode: 'public', cfg: {}, users: {}, blocked: [], white: [],
  stats: { newContacts: 0, cmds: 0, sanctions: 0, blocks: 0, calls: 0 },
  meta: { lastSummary: 0, blocksDay: '', blocksToday: 0 },
};
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) { console.error('[pmguard] lecture base:', e.message); }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
      fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    } catch (e) { console.error('[pmguard] écriture base:', e.message); }
  }, 1000);
}

const cf = () => ({ ...CFG, ...db.cfg });
const today = () => new Date().toISOString().slice(0, 10);
const U = k => (db.users[k] ||= {
  first: Date.now(), last: Date.now(), strikes: [], ignoreUntil: 0, calls: [],
  lastCmd: 0, qDay: '', qCount: 0, qNotified: false, notifiedDay: '', notifiedCallDay: '',
});

// ════════════════════════ Utilitaires ════════════════════════
const num = j => String(j || '').split('@')[0].split(':')[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isOwnerNum = j => OWNERS.includes(num(j));
const isPm = jid => /@(s\.whatsapp\.net|lid)$/.test(String(jid || ''));
const jidOf = k => `${k}@s.whatsapp.net`;

// Envoi discret : "en train d'écrire…" + délai aléatoire (comportement humain)
async function send(conn, jid, text) {
  try {
    await conn.presenceSubscribe(jid);
    await conn.sendPresenceUpdate('composing', jid);
    await sleep(800 + Math.random() * 1500);
    await conn.sendMessage(jid, { text });
    await conn.sendPresenceUpdate('paused', jid);
  } catch (e) { console.error('[pmguard] envoi:', e.message); }
}
const alertOwner = (conn, text) => conn.sendMessage(jidOf(OWNERS[0]), { text }).catch(() => {});

function content(mek) {
  let m = mek.message || {};
  for (let i = 0; i < 4; i++) {
    const n = m.ephemeralMessage?.message || m.viewOnceMessage?.message ||
              m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
    if (!n) break;
    m = n;
  }
  return m;
}
const textOf = c => c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption ||
                    c.videoMessage?.caption || c.documentMessage?.caption || '';
const ctxInfo = c => { const k = Object.keys(c).find(x => c[x]?.contextInfo); return k ? c[k].contextInfo : null; };
const targetOf = mek => { const ci = ctxInfo(content(mek)); return ci?.mentionedJid?.[0] || ci?.participant || null; };
const isCommand = t => PREFIXES.some(p => t.startsWith(p) && /^[a-z0-9]/i.test(t.slice(p.length)));

// ════════════════════════ Sanctions ════════════════════════
async function blockUser(conn, jid, k, why) {
  if (db.meta.blocksDay !== today()) { db.meta.blocksDay = today(); db.meta.blocksToday = 0; }
  if (db.meta.blocksToday >= cf().maxBlocksPerDay) { // trop de blocages aujourd'hui : on évite d'attirer l'attention
    U(k).ignoreUntil = Date.now() + 864e5;
    alertOwner(conn, box('⚠️ ALERTE', [
      { raw: `Quota de blocages atteint : +${k} ignoré 24 h (${why}).` },
    ]));
    return;
  }
  db.meta.blocksToday++;
  db.stats.blocks++;
  if (!db.blocked.includes(k)) db.blocked.push(k);
  U(k).strikes = [];
  await sleep(1000 + Math.random() * 2000);
  try { await conn.updateBlockStatus(jid, 'block'); } catch (e) { console.error('[pmguard] blocage:', e.message); }
  alertOwner(conn, box('🚫 BLOCAGE', [
    { raw: `+${k} bloqué : ${why}.` },
  ]));
}

// 1re faute : avertissement · 2e : ignoré X min · 3e : blocage
async function strike(conn, jid, k, why) {
  const c = cf(), u = U(k), now = Date.now();
  u.strikes = u.strikes.filter(t => now - t < c.strikeExpireDays * 864e5);
  u.strikes.push(now);
  db.stats.sanctions++;
  const n = u.strikes.length;
  if (n === 1) {
    await send(conn, jid, box('⚠️ AVERTISSEMENT', [
      { raw: `Avertissement 1/3 : ${why}. Merci de ralentir.` },
    ]));
  } else if (n === 2) {
    u.ignoreUntil = now + c.ignoreMinutes * 60_000;
    await send(conn, jid, box('⚠️ AVERTISSEMENT', [
      { raw: `Avertissement 2/3 : ${why}. Je vous ignore pendant ${c.ignoreMinutes} min.` },
    ]));
  } else {
    await blockUser(conn, jid, k, why);
  }
  save();
}

// ════════════════════════ Porte d'entrée : à appeler avant l'exécution des commandes ════════════════════════
const flood = new Map();

async function pmGate(conn, mek, isOwner = false) {
  try {
    const jid = mek.key?.remoteJid;
    if (!isPm(jid)) return true;         // groupes, statuts, chaînes : hors périmètre
    attach(conn);
    if (mek.key.fromMe) return true;

    const ids = [jid, mek.key.remoteJidAlt, mek.key.senderPn].filter(Boolean);
    if (isOwner || ids.some(isOwnerNum)) return true; // le propriétaire n'est jamais filtré

    const k = num(jid), now = Date.now(), c = cf();
    if (db.blocked.includes(k)) return false;

    const isNew = !db.users[k];
    const u = U(k);
    u.last = now;
    if (isNew) db.stats.newContacts++;

    const text = textOf(content(mek));
    const cmdMsg = isCommand(text);

    // ── Mode privé : seul le propriétaire ──
    if (db.mode === 'private') {
      if (cmdMsg && u.notifiedDay !== today()) { // avis unique par jour, uniquement si une commande est tentée
        u.notifiedDay = today();
        await send(conn, jid, box('🔒 MODE PRIVÉ', [
          { raw: 'Ce bot est actuellement en mode privé.' },
        ]));
      }
      save();
      return false;
    }

    // ── Mode public ──
    if (u.ignoreUntil > now) return false;
    if (db.white.includes(k)) return true; // liste blanche : exemptée des protections

    // Anti-bug : message anormalement gros → ignoré sans traitement, 24 h, alerte propriétaire
    let size = 0;
    try { size = JSON.stringify(mek.message || {}).length; } catch { /* ignoré */ }
    if (text.length > c.maxTextLength || size > c.maxPayloadBytes) {
      u.ignoreUntil = now + 864e5;
      db.stats.sanctions++;
      alertOwner(conn, box('🐛 ALERTE', [
        { raw: `Message anormal de +${k} (${size} octets) : ignoré, numéro ignoré 24 h.` },
      ]));
      save();
      return false;
    }

    // Anti-flood
    const hits = (flood.get(k) || []).filter(t => now - t < c.floodWindowSec * 1000);
    hits.push(now);
    flood.set(k, hits);
    if (hits.length > c.floodMax) {
      flood.delete(k);
      await strike(conn, jid, k, 'trop de messages en peu de temps');
      return false;
    }

    // Commandes : délai minimum + quota quotidien
    if (cmdMsg) {
      if (now - u.lastCmd < c.cmdCooldownSec * 1000) return false; // ignoré en silence
      u.lastCmd = now;
      if (c.dailyQuota > 0) {
        if (u.qDay !== today()) { u.qDay = today(); u.qCount = 0; u.qNotified = false; }
        u.qCount++;
        if (u.qCount > c.dailyQuota) {
          if (!u.qNotified) { u.qNotified = true; await send(conn, jid, box('⏳ QUOTA', [
            { raw: `Limite de ${c.dailyQuota} commandes par jour atteinte. Revenez demain.` },
          ])); }
          return false;
        }
      }
      db.stats.cmds++;
    }
    save();
    return true; // les messages qui ne sont pas des commandes passent : le bot n'y répond pas de lui-même
  } catch (e) {
    console.error('[pmguard] gate:', e.message);
    return true; // en cas d'erreur interne, on ne bloque pas le bot
  }
}

// ════════════════════════ Appels : rejet automatique ════════════════════════
async function onCalls(conn, calls) {
  const c = cf();
  for (const call of calls) {
    if (call.status !== 'offer' || call.isGroup) continue;
    const jid = call.from, k = num(jid);
    if ([call.from, call.callerPn].filter(Boolean).some(isOwnerNum) || db.white.includes(k)) continue;

    await sleep(500 + Math.random() * 1000);
    await conn.rejectCall(call.id, call.from).catch(() => {});
    db.stats.calls++;

    const known = !!db.users[k]; // on ne répond qu'à quelqu'un qui a déjà écrit au bot
    const u = U(k), now = Date.now();
    u.calls = u.calls.filter(t => now - t < 864e5);
    u.calls.push(now);

    if (u.calls.length >= c.callsBeforeBlock) {
      const n = u.calls.length;
      u.calls = [];
      await blockUser(conn, jid, k, `${n} appels en 24 h`);
    } else if (known && u.notifiedCallDay !== today()) {
      u.notifiedCallDay = today();
      await send(conn, jid, box('📵 APPEL REFUSÉ', [
        { raw: 'Ce numéro est un bot : il ne prend pas d\'appels.' },
        { raw: 'Utilisez les commandes par message.' },
      ]));
    }
    save();
  }
}

// ════════════════════════ Résumé quotidien au propriétaire ════════════════════════
let CONN = null, started = false;

function attach(conn) {
  CONN = conn; // toujours la connexion la plus récente (après reconnexion)
  if (!conn.__pmHooked) {
    conn.__pmHooked = true;
    conn.ev.on('call', calls => onCalls(conn, calls).catch(e => console.error('[pmguard] appels:', e.message)));
  }
  if (!started) {
    started = true;
    db.meta.lastSummary ||= Date.now();
    setInterval(() => CONN && summary(CONN).catch(e => console.error('[pmguard] résumé:', e.message)), 60_000);
  }
}

async function summary(conn) {
  const now = Date.now();
  if (now - (db.meta.lastSummary || 0) < 864e5) return;
  db.meta.lastSummary = now;
  const s = db.stats;
  if (s.newContacts || s.sanctions || s.blocks || s.calls) {
    await alertOwner(conn, box('📊 RÉSUMÉ PRIVÉ (24 h)', [
      { label: 'Nouveaux contacts', value: s.newContacts },
      { label: 'Commandes traitées', value: s.cmds },
      { label: 'Sanctions', value: s.sanctions },
      { label: 'Blocages', value: s.blocks },
      { label: 'Appels rejetés', value: s.calls },
    ]));
  }
  db.stats = { newContacts: 0, cmds: 0, sanctions: 0, blocks: 0, calls: 0 };
  for (const [k, u] of Object.entries(db.users)) { // ménage : contacts inactifs depuis 90 j et sans sanction
    if (now - (u.last || u.first) > 90 * 864e5 && !u.strikes.length && !db.blocked.includes(k)) delete db.users[k];
  }
  save();
}

// ════════════════════════ Commande unique : .pm ════════════════════════
cmd({ pattern: 'pm', desc: 'Protection des discussions privées (.pm public|private|status|block|unblock|white|unwhite|set)', category: 'owner', filename: __filename },
async (conn, mek, m, { isOwner, q, reply }) => {
  if (!isOwner) return reply(box('ERROR', [{ raw: 'Réservé au propriétaire.' }]));
  const [sub = 'status', ...rest] = (q || '').trim().split(/\s+/);
  const arg = rest.join(' ');
  const digits = (arg.match(/\d{6,15}/) || [])[0] || num(targetOf(mek));

  switch (sub.toLowerCase()) {
    case 'public':
    case 'private':
      db.mode = sub.toLowerCase();
      save();
      return reply(box('SUCCESS', [
        { raw: db.mode === 'public'
          ? 'Mode *public* : tout le monde peut utiliser mes commandes en privé.'
          : 'Mode *privé* : seul le propriétaire peut utiliser le bot en privé.' },
      ]));

    case 'block':
    case 'unblock':
    case 'white':
    case 'unwhite': {
      if (!digits) return reply(box('ERROR', [
        { raw: `Précisez le numéro : *.pm ${sub} 2376XXXXXXXX* (ou mentionnez/citez la personne)` },
      ]));
      if (isOwnerNum(digits)) return reply(box('ERROR', [{ raw: 'Impossible sur un numéro propriétaire.' }]));
      const s = sub.toLowerCase();
      if (s === 'block') {
        if (!db.blocked.includes(digits)) db.blocked.push(digits);
        await conn.updateBlockStatus(jidOf(digits), 'block').catch(() => {});
        reply(box('SUCCESS', [{ raw: `+${digits} bloqué.` }]));
      } else if (s === 'unblock') {
        db.blocked = db.blocked.filter(x => x !== digits);
        if (db.users[digits]) { db.users[digits].strikes = []; db.users[digits].ignoreUntil = 0; }
        await conn.updateBlockStatus(jidOf(digits), 'unblock').catch(() => {});
        reply(box('SUCCESS', [{ raw: `+${digits} débloqué.` }]));
      } else if (s === 'white') {
        if (!db.white.includes(digits)) db.white.push(digits);
        reply(box('SUCCESS', [{ raw: `+${digits} est exempté des protections (anti-flood, anti-appel, quota).` }]));
      } else {
        db.white = db.white.filter(x => x !== digits);
        reply(box('SUCCESS', [{ raw: `+${digits} retiré de la liste blanche.` }]));
      }
      return save();
    }

    case 'set': {
      const [key, raw] = arg.split(/\s+/);
      if (!(key in CFG)) return reply(box('INFO', [
        { raw: 'Clés disponibles :' },
        { raw: Object.keys(CFG).join(', ') },
      ]));
      const val = Number(raw);
      const min = key === 'dailyQuota' ? 0 : 1;
      if (!Number.isFinite(val) || val < min) return reply(box('ERROR', [{ raw: `Valeur invalide (minimum ${min}).` }]));
      db.cfg[key] = val;
      save();
      return reply(box('SUCCESS', [{ raw: `${key} = ${val}` }]));
    }

    default: {
      const c = cf();
      return reply(box('🛡️ PMGUARD', [
        { label: 'Mode', value: db.mode === 'public' ? '🌍 public' : '🔒 privé' },
        { label: 'Bloqués', value: db.blocked.length },
        { label: 'Liste blanche', value: db.white.length },
        { label: 'Anti-flood', value: `${c.floodMax} msg / ${c.floodWindowSec} s` },
        { label: 'Délai commandes', value: `${c.cmdCooldownSec} s` },
        { label: 'Quota quotidien', value: c.dailyQuota || 'illimité' },
        { label: 'Appels', value: 'rejetés automatiquement' },
      ]));
    }
  }
});

module.exports = { pmGate };
