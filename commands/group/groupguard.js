'use strict';
/**
 * GroupGuard — protection automatique des groupes WhatsApp
 * Baileys + méthode cmd()   →   à placer dans plugins/groupguard.js
 *
 * Automatique (aucune commande) : anti-lien, filtres de contenu, avertissements 1/3 → 3/3,
 * mute, expulsion, bannissement, protection des admins, anti-raid, captcha, filtre pays,
 * nettoyage des inactifs, sauvegarde quotidienne, rapport hebdomadaire.
 * Manuel : .protect on|off · .lockdown · .unlockdown · .whitelist · .status · .guardset
 */
const fs = require('fs');
const path = require('path');
const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

// ════════════════════════ Configuration ════════════════════════
// Numéros propriétaires, sans "+" (ex. 2376XXXXXXXX), séparés par des virgules
const OWNERS = (process.env.OWNER_NUMBER || '237693978044').split(',').map(s => s.trim()).filter(Boolean);

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'groupguard.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Valeurs par défaut, modifiables par groupe avec .guardset
const DEFAULTS = {
  maxWarns: 3,             // avertissements avant expulsion
  warnExpireDays: 30,      // un avertissement expire après X jours sans faute
  muteMinutes: 30,         // durée du mute à l'avant-dernier avertissement
  maxTextLength: 1000,     // caractères max par message
  blockContact: true,      // cartes de contact
  blockForwarded: true,    // messages transférés
  blockStatusMention: true,// mentions du groupe en statut
  blockPhone: false,       // numéros écrits dans les messages (risque de faux positifs)
  raidCount: 10,           // arrivées ...
  raidWindowSec: 60,       // ... en X secondes = raid → groupe fermé
  captchaSec: 120,         // délai de réponse du captcha (0 = désactivé)
  allowedCountries: ['237'], // indicatifs autorisés ([] = tous)
  inactiveWarnDays: 53,    // préavis d'inactivité
  inactiveKickDays: 60,    // expulsion (au moins 7 j après le préavis)
};

// Réglages appliqués par .lockdown
const STRICT = {
  maxWarns: 2, maxTextLength: 300, blockPhone: true, blockContact: true,
  blockForwarded: true, blockStatusMention: true, raidCount: 5, captchaSec: 120,
};

// ════════════════════════ Stockage (JSON, écriture atomique) ════════════════════════
let db = { groups: {}, meta: { lastDaily: 0, lastReport: 0 } };
try {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) { console.error('[guard] lecture base:', e.message); }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
      fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    } catch (e) { console.error('[guard] écriture base:', e.message); }
  }, 1000);
}

const G = jid => (db.groups[jid] ||= {
  enabled: false, cfg: {}, snapshot: null,
  warns: {}, muted: {}, kicked: {}, banned: [], whitelist: [],
  pending: {}, lastSeen: {}, notified: {}, joins: [], logs: [],
});
const C = g => ({ ...DEFAULTS, ...g.cfg });
const log = (g, k, txt) => { g.logs.push({ t: Date.now(), k, txt }); if (g.logs.length > 200) g.logs.shift(); };

// ════════════════════════ Utilitaires ════════════════════════
const num = j => String(j || '').split('@')[0].split(':')[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = () => sleep(800 + Math.random() * 1700); // délai aléatoire anti-détection
const rand = n => Math.floor(Math.random() * n);
const isOwnerNum = j => OWNERS.includes(num(j));
const isMe = (conn, j) => [conn.user?.id, conn.user?.lid].filter(Boolean).map(num).includes(num(j));

const say = (conn, jid, text, mentions = []) => conn.sendMessage(jid, { text, mentions }).catch(() => {});
const alertOwner = (conn, text) => conn.sendMessage(`${OWNERS[0]}@s.whatsapp.net`, { text }).catch(() => {});
const del = (conn, jid, key) => conn.sendMessage(jid, { delete: key }).catch(e => console.error('[guard] delete:', e.message));

// Métadonnées de groupe en cache (60 s) pour ne pas solliciter WhatsApp à chaque message
const metaCache = new Map();
async function getMeta(conn, jid) {
  const c = metaCache.get(jid);
  if (c && Date.now() - c.t < 60_000) return c.m;
  const m = await conn.groupMetadata(jid);
  metaCache.set(jid, { m, t: Date.now() });
  return m;
}
const pIds = p => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(num);
const findP = (meta, j) => meta.participants.find(p => pIds(p).includes(num(j)));
const isAdminIn = (meta, j) => !!findP(meta, j)?.admin;
const botIsAdmin = (conn, meta) => [conn.user?.id, conn.user?.lid].filter(Boolean).some(j => isAdminIn(meta, j));

// Contenu du message (déballe éphémère / vue unique)
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

// ════════════════════════ Détection ════════════════════════
const LINK_RE = /(?:https?:\/\/|www\.)\S+|wa\.me\/\S+|chat\.whatsapp\.com\/\S+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|info|xyz|link|me|gg|ly|co|app|site|online|shop|top|club|cm)\b/i;
const PHONE_RE = /(?:\+?\d[\s.\-]?){9,}/;

function violation(c, text, cf) {
  if (LINK_RE.test(text)) return 'lien interdit';
  if (cf.blockContact && (c.contactMessage || c.contactsArrayMessage)) return 'carte de contact interdite';
  if (cf.blockForwarded && ctxInfo(c)?.isForwarded) return 'message transféré interdit';
  if (text.length > cf.maxTextLength) return 'message trop long';
  if (cf.blockPhone && PHONE_RE.test(text)) return 'numéro de téléphone interdit';
  // Le nom de ce type varie selon la version de Baileys : vérifiez-le sur la vôtre
  if (cf.blockStatusMention && c.groupStatusMentionMessage) return 'mention du groupe en statut';
  return null;
}

// Liens récents (pour .lockdown) : 1 h max, 50 par groupe
const recent = new Map();
function remember(jid, key, exempt) {
  const now = Date.now();
  const arr = (recent.get(jid) || []).filter(r => now - r.t < 3_600_000).slice(-49);
  arr.push({ key, t: now, exempt });
  recent.set(jid, arr);
}

// ════════════════════════ Sanctions ════════════════════════
async function kick(conn, jid, target, meta) {
  await human();
  const pid = (meta && findP(meta, target)?.id) || target;
  try { await conn.groupParticipantsUpdate(jid, [pid], 'remove'); }
  catch (e) { console.error('[guard] kick:', e.message); }
}

async function sanction(conn, jid, sender, mek, reason, meta) {
  const g = G(jid), cf = C(g), now = Date.now(), k = num(sender), tag = `@${k}`;
  await human();
  await del(conn, jid, mek.key);

  const list = (g.warns[k] || []).filter(t => now - t < cf.warnExpireDays * 864e5);
  list.push(now);
  g.warns[k] = list;
  const n = list.length;
  log(g, k, `${reason} (${n}/${cf.maxWarns})`);

  if (g.kicked[k]) { // récidive après retour → bannissement
    if (!g.banned.includes(k)) g.banned.push(k);
    await say(conn, jid, `⛔ ${tag} est banni définitivement (récidive : ${reason}).`, [sender]);
    return kick(conn, jid, sender, meta);
  }
  if (n >= cf.maxWarns) {
    g.kicked[k] = now;
    delete g.warns[k];
    await say(conn, jid, `🚫 ${tag} est expulsé : ${cf.maxWarns}/${cf.maxWarns} avertissements (${reason}).`, [sender]);
    return kick(conn, jid, sender, meta);
  }
  if (n === cf.maxWarns - 1) g.muted[k] = now + cf.muteMinutes * 60_000;
  await say(conn, jid,
    `⚠️ ${tag}, avertissement ${n}/${cf.maxWarns} : ${reason}.` +
    (g.muted[k] > now ? `\n🔇 Vous êtes muet pendant ${cf.muteMinutes} min.` : ''), [sender]);
}

// ════════════════════════ Accrochage : messages ════════════════════════
// NB : "on: 'body'" = gestionnaire appelé pour chaque message. Adaptez si votre loader
// nomme ce mode autrement ("text", "message", ...).
let CONN = null, started = false, busy = false;
const warnedNoAdmin = new Map();

function attach(conn) {
  CONN = conn; // toujours la connexion la plus récente (après reconnexion)
  if (!conn.__guardHooked) {
    conn.__guardHooked = true;
    conn.ev.on('group-participants.update', ev =>
      onParticipants(conn, ev).catch(e => console.error('[guard] participants:', e.message)));
  }
  if (!started) {
    started = true;
    setInterval(() => {
      if (busy || !CONN) return;
      busy = true;
      maintenance(CONN).catch(e => console.error('[guard] maintenance:', e.message)).finally(() => { busy = false; });
    }, 30_000);
  }
}

cmd({ on: 'body' }, async (conn, mek, m, { from, isGroup }) => {
  try {
    attach(conn);
    if (!isGroup || mek.key.fromMe) return;
    const g = G(from);
    if (!g.enabled) return;
    const sender = mek.key.participant || mek.participant;
    if (!sender) return;

    const now = Date.now(), k = num(sender);
    const meta = await getMeta(conn, from);
    const exempt = isAdminIn(meta, sender) || isOwnerNum(sender) || g.whitelist.includes(k);
    const c = content(mek), text = textOf(c);

    g.lastSeen[k] = now;
    delete g.notified[k];
    if (LINK_RE.test(text)) remember(from, mek.key, exempt);

    // Captcha : bonne réponse = membre validé
    if (g.pending[k] && text.trim() === g.pending[k].answer) {
      delete g.pending[k];
      await say(conn, from, `✅ Merci @${k}, vérification réussie.`, [sender]);
      return;
    }

    if (!botIsAdmin(conn, meta)) {
      if (now - (warnedNoAdmin.get(from) || 0) > 6 * 3_600_000) {
        warnedNoAdmin.set(from, now);
        alertOwner(conn, `⚠️ Protection active mais je ne suis pas admin dans "${meta.subject}".`);
      }
      return;
    }
    if (exempt) return;

    if ((g.muted[k] || 0) > now) { await del(conn, from, mek.key); return; } // mute en cours

    const why = violation(c, text, C(g));
    if (why) await sanction(conn, from, sender, mek, why, meta);
  } catch (e) {
    console.error('[guard] message:', e.message);
  } finally {
    save();
  }
});

// ════════════════════════ Accrochage : arrivées, départs, promotions ════════════════════════
async function onParticipants(conn, ev) {
  const { id: jid, action, author } = ev;
  const parts = (ev.participants || []).map(p => (typeof p === 'string' ? { id: p } : p));
  metaCache.delete(jid);

  // Le bot perd son statut admin → prévenir le propriétaire
  if (action === 'demote' && parts.some(p => isMe(conn, p.id))) {
    return alertOwner(conn, `⚠️ Je ne suis plus admin dans le groupe ${jid}.`);
  }
  const g = G(jid);
  if (!g.enabled) return;
  const cf = C(g), now = Date.now();

  // Sans "author" (anciennes versions de Baileys) on ne peut pas juger : on ne touche à rien
  const trusted = !author || isMe(conn, author) || isOwnerNum(author);

  if (action === 'promote' && !trusted) {
    for (const p of parts) {
      await human();
      await conn.groupParticipantsUpdate(jid, [p.id], 'demote').catch(() => {});
      log(g, num(p.id), `promotion annulée (par ${num(author)})`);
    }
    await say(conn, jid, `🛡️ Promotion non autorisée annulée (initiée par @${num(author)}).`, [author]);
  }

  if (action === 'demote' && !trusted) {
    for (const p of parts) {
      if (num(p.id) === num(author)) continue; // un admin qui se retire lui-même : on laisse
      await human();
      await conn.groupParticipantsUpdate(jid, [p.id], 'promote').catch(() => {});
      log(g, num(p.id), `rétablissement admin (retiré par ${num(author)})`);
    }
    await say(conn, jid, `🛡️ Rétrogradation non autorisée annulée (initiée par @${num(author)}).`, [author]);
  }

  if (action !== 'add') { save(); return; }

  // ── Arrivées ──
  const meta = await getMeta(conn, jid).catch(() => null);
  g.joins = g.joins.filter(t => now - t < cf.raidWindowSec * 1000);

  for (const p of parts) {
    const k = num(p.id);
    if (isOwnerNum(p.id) || isMe(conn, p.id) || g.whitelist.includes(k)) continue;

    if (g.banned.includes(k)) { log(g, k, 'banni : retrait immédiat'); await kick(conn, jid, p.id, meta); continue; }

    // Filtre pays (impossible si WhatsApp ne fournit qu'un identifiant @lid)
    const phone = p.phoneNumber || (String(p.id).endsWith('@lid') ? '' : p.id);
    if (phone && cf.allowedCountries.length && !cf.allowedCountries.some(cc => num(phone).startsWith(cc))) {
      log(g, k, 'pays non autorisé');
      await kick(conn, jid, p.id, meta);
      continue;
    }

    g.joins.push(now);

    if (cf.captchaSec > 0) {
      const a = 1 + rand(9), b = 1 + rand(9);
      g.pending[k] = { answer: String(a + b), until: now + cf.captchaSec * 1000 };
      await say(conn, jid,
        `👋 Bienvenue @${k} ! Vérification : répondez par le résultat de *${a} + ${b}* ` +
        `dans ${Math.max(1, Math.round(cf.captchaSec / 60))} min, sinon vous serez retiré.`, [p.id]);
    }
  }

  // ── Anti-raid ──
  if (g.joins.length >= cf.raidCount) {
    g.joins = [];
    await conn.groupSettingUpdate(jid, 'announcement').catch(() => {});
    await say(conn, jid, '🚨 Afflux anormal de nouveaux membres : groupe fermé par précaution. Un admin peut le rouvrir.');
    await alertOwner(conn, `🚨 Raid détecté et groupe fermé : ${meta?.subject || jid}`);
    log(g, '-', 'raid : groupe fermé');
  }
  save();
}

// ════════════════════════ Tâches périodiques (résistent aux redémarrages) ════════════════════════
async function maintenance(conn) {
  const now = Date.now();
  for (const [jid, g] of Object.entries(db.groups)) {
    if (!g.enabled) continue;
    for (const [k, t] of Object.entries(g.muted)) if (t <= now) delete g.muted[k];

    for (const [k, p] of Object.entries(g.pending)) { // captcha expiré → retrait
      if (p.until > now) continue;
      delete g.pending[k];
      const meta = await getMeta(conn, jid).catch(() => null);
      const part = meta && findP(meta, k);
      if (part && !part.admin) {
        log(g, k, 'captcha non résolu');
        await kick(conn, jid, part.id, meta);
        await say(conn, jid, `⏱️ @${k} retiré : vérification non effectuée.`, [part.id]);
      }
    }
  }
  if (now - (db.meta.lastDaily || 0) > 864e5) { db.meta.lastDaily = now; await daily(conn); }
  save();
}

async function daily(conn) {
  const now = Date.now();

  // Sauvegarde quotidienne (7 dernières conservées)
  try {
    fs.writeFileSync(path.join(BACKUP_DIR, `groupguard-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(db));
    fs.readdirSync(BACKUP_DIR).sort().slice(0, -7).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  } catch (e) { console.error('[guard] sauvegarde:', e.message); }

  const weekly = now - (db.meta.lastReport || 0) > 7 * 864e5;
  if (weekly) db.meta.lastReport = now;
  const report = [];

  for (const [jid, g] of Object.entries(db.groups)) {
    if (!g.enabled) continue;
    await sleep(2000 + Math.random() * 2000);
    const meta = await getMeta(conn, jid).catch(() => null);
    if (!meta) continue;

    const cf = C(g), toWarn = [], idleList = [];
    let kicks = 0;
    for (const p of meta.participants) {
      const k = num(p.id);
      if (p.admin || isOwnerNum(p.id) || isMe(conn, p.id) || g.whitelist.includes(k)) continue;
      g.lastSeen[k] ??= now; // 1re observation : le compteur démarre maintenant
      const idle = Math.floor((now - g.lastSeen[k]) / 864e5);

      if (idle >= cf.inactiveKickDays && g.notified[k] && now - g.notified[k] >= 7 * 864e5 && kicks < 5) {
        kicks++;
        log(g, k, `inactif depuis ${idle} j : expulsé`);
        await kick(conn, jid, p.id, meta);
        delete g.lastSeen[k]; delete g.notified[k];
      } else if (idle >= cf.inactiveWarnDays && !g.notified[k] && toWarn.length < 20) {
        g.notified[k] = now;
        toWarn.push(p.id);
      }
      if (idle >= 30) idleList.push(`+${k} (${idle} j)`);
    }

    if (toWarn.length) {
      await say(conn, jid,
        `⚠️ Inactivité : ${toWarn.map(j => '@' + num(j)).join(' ')}\n` +
        `Écrivez un message dans les ${cf.inactiveKickDays - cf.inactiveWarnDays} prochains jours pour rester dans le groupe.`, toWarn);
    }
    if (weekly && idleList.length) {
      report.push(`*${meta.subject}* : ${idleList.length} inactif(s) depuis 30 j+\n${idleList.slice(0, 25).join(', ')}`);
    }
  }
  if (weekly && report.length) await alertOwner(conn, `📊 *Rapport hebdomadaire d'inactivité*\n\n${report.join('\n\n')}`);
}

// ════════════════════════ Commandes (cmd) ════════════════════════
const canUse = (isAdmins, isOwner) => isAdmins || isOwner;

cmd({ pattern: 'protect', desc: 'Active/désactive la protection automatique du groupe', category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const arg = (q || '').trim().toLowerCase();
  if (!['on', 'off'].includes(arg)) return reply(boxWithFooter('USAGE', [{ raw: 'Usage : *.protect on* ou *.protect off*' }]));
  if (arg === 'on' && !botIsAdmin(conn, await getMeta(conn, from))) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Je dois être admin du groupe.' }]));
  G(from).enabled = arg === 'on';
  save();
  reply(arg === 'on'
    ? boxWithFooter('SUCCÈS', [{ raw: '🛡️ Protection automatique activée.' }])
    : boxWithFooter('SUCCÈS', [{ raw: '🔓 Protection automatique désactivée.' }]));
});

cmd({ pattern: 'lockdown', desc: "Mode d'urgence : ferme le groupe et durcit toutes les protections", category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const g = G(from), meta = await getMeta(conn, from);
  if (!botIsAdmin(conn, meta)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Je dois être admin du groupe.' }]));
  if (g.snapshot) return reply(boxWithFooter('INFO', [{ raw: '🔒 Mode urgence déjà actif. *.unlockdown* pour sortir.' }]));

  g.snapshot = { enabled: g.enabled, announce: !!meta.announce, cfg: { ...g.cfg } };
  g.enabled = true;
  g.cfg = { ...g.cfg, ...STRICT };
  await conn.groupSettingUpdate(from, 'announcement'); // seuls les admins écrivent

  let n = 0; // suppression des liens récents (non-admins)
  for (const r of recent.get(from) || []) {
    if (!r.exempt && Date.now() - r.t < 3_600_000) { await human(); await del(conn, from, r.key); n++; }
  }
  recent.delete(from);
  metaCache.delete(from);
  log(g, '-', 'mode urgence activé');
  save();
  reply(boxWithFooter('MODE URGENCE', [
    { raw: '🚨 Groupe fermé (admins seulement)' },
    { raw: '• Protections au maximum' },
    { raw: `• ${n} lien(s) récent(s) supprimé(s)` },
    { blank: true },
    { raw: 'Utilisez *.unlockdown* pour revenir à la normale.' }
  ]));
});

cmd({ pattern: 'unlockdown', desc: "Quitte le mode d'urgence et restaure la configuration précédente", category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const g = G(from);
  if (!g.snapshot) return reply(boxWithFooter('INFO', [{ raw: 'ℹ️ Mode urgence pas actif.' }]));
  const s = g.snapshot;
  g.enabled = s.enabled;
  g.cfg = s.cfg;
  g.snapshot = null;
  await conn.groupSettingUpdate(from, s.announce ? 'announcement' : 'not_announcement');
  metaCache.delete(from);
  log(g, '-', 'mode urgence désactivé');
  save();
  reply(boxWithFooter('SUCCÈS', [{ raw: '✅ Mode urgence désactivé : configuration restaurée.' }]));
});

cmd({ pattern: 'whitelist', desc: 'Exempte un membre des protections (.whitelist @membre | .whitelist del @membre)', category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const t = targetOf(mek);
  if (!t) return reply(boxWithFooter('USAGE', [{ raw: 'Mentionnez ou citez le membre : *.whitelist @membre*' }]));
  const g = G(from), k = num(t);
  if (/^\s*(del|remove|retirer)/i.test(q || '')) {
    g.whitelist = g.whitelist.filter(x => x !== k);
    reply(boxWithFooter('SUCCÈS', [{ raw: `✅ +${k} retiré de la liste blanche.` }]));
  } else {
    if (!g.whitelist.includes(k)) g.whitelist.push(k);
    reply(boxWithFooter('SUCCÈS', [{ raw: `✅ +${k} exempté des protections.` }]));
  }
  save();
});

cmd({ pattern: 'status', desc: 'État des protections du groupe', category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const g = G(from), cf = C(g);
  const last = g.logs.slice(-5).map(l => `• +${l.k} : ${l.txt}`).join('\n') || '—';
  reply(boxWithFooter('GroupGuard', [
    { label: 'Protection', value: g.enabled ? '✅ active' : '❌ inactive' },
    { label: 'Urgence', value: g.snapshot ? '🔒 actif' : '—' },
    { label: 'Max warns', value: `${cf.maxWarns} (expirent ${cf.warnExpireDays}j)` },
    { label: 'Mute', value: `${cf.muteMinutes} min` },
    { label: 'Pays', value: cf.allowedCountries.join(', ') || 'tous' },
    { label: 'Bannis', value: g.banned.length },
    { blank: true },
    { raw: '*Dernières sanctions*' },
    { raw: last }
  ]));
});

cmd({ pattern: 'guardset', desc: 'Règle un seuil, ex. .guardset maxWarns 3', category: 'group', filename: __filename },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
  if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Commande réservée aux groupes.' }]));
  if (!canUse(isAdmins, isOwner)) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Réservé aux admins.' }]));
  const [key, ...rest] = (q || '').trim().split(/\s+/);
  if (!(key in DEFAULTS)) return reply(boxWithFooter('INFO', [{ raw: `Clés disponibles : ${Object.keys(DEFAULTS).join(', ')}` }]));
  const raw = rest.join(' '), def = DEFAULTS[key];
  let val;
  if (Array.isArray(def)) val = raw.split(/[,\s]+/).filter(Boolean);
  else if (typeof def === 'boolean') val = /^(on|true|1|oui)$/i.test(raw);
  else {
    val = Number(raw);
    const min = ['captchaSec', 'blockPhone'].includes(key) ? 0 : 1;
    if (!Number.isFinite(val) || val < min) return reply(boxWithFooter('ERREUR', [{ raw: `❌ Valeur invalide (minimum ${min}).` }]));
  }
  G(from).cfg[key] = val;
  save();
  reply(boxWithFooter('SUCCÈS', [{ raw: `✅ ${key} = ${Array.isArray(val) ? val.join(', ') || 'tous' : val}` }]));
});
