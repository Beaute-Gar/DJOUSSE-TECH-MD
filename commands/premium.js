'use strict';
/**
 * Premium — commandes payantes par Mobile Money — Baileys + cmd()
 *
 * Flux :  .premium → .pay <offre> → paiement → .pay <REF> <ID> (+ capture)
 *         → pré-contrôle OCR gratuit → .prem approve/refuse
 *
 * OCR gratuit via ocr.space (500 req/jour, aucune clé payante)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cmd } = require('./command.cjs');
const { box } = require('./lib/djousse-ui.cjs');

// ════════════════════════ Configuration ════════════════════════
const OWNERS = (process.env.OWNER_NUMBER || '237693978044').split(',').map(s => s.trim()).filter(Boolean);
const PREFIXES = (process.env.PREFIX || '.').split(',').map(s => s.trim()).filter(Boolean);

const PAY_NUMBERS = [
  { label: 'MTN MoMo', number: process.env.PAY_MTN },
  { label: 'Orange Money', number: process.env.PAY_ORANGE },
].filter(p => p.number);
const PAY_NAME = process.env.PAY_NAME || '';
const CURRENCY = 'FCFA';
const REQUEST_WINDOW_MIN = 30;

const DEFAULT_PREMIUM = [
  'ai', 'gpt', 'gemini', 'imagine', 'dalle', 'remini', 'removebg',
  'antilink', 'antiflood', 'antibadword', 'mute', 'ban', 'kick', 'warn',
  'promote', 'demote', 'hidetag', 'tagall', 'grouplink', 'welcome', 'goodbye',
  'setname', 'setpp', 'pending', 'creategroup', 'deldup',
  'broadcast', 'block', 'unblock', 'afk',
];
const RESERVED = new Set(['premium', 'pay', 'prem']);

const DEFAULT_PLANS = {
  jour:    { label: 'Accès 24h',    days: 1,  price: 200 },
  semaine: { label: 'Accès 7 jours', days: 7,  price: 1000 },
  mois:    { label: 'Accès 30 jours', days: 30, price: 3000 },
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'premium.json');

let db = {
  premiumCmds: [...DEFAULT_PREMIUM],
  plans: JSON.parse(JSON.stringify(DEFAULT_PLANS)),
  freeDaily: 0,
  users: {},
  requests: {},
  usedTx: {},
  usedHash: {},
};
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) { console.error('[premium] lecture base:', e.message); }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
      fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    } catch (e) { console.error('[premium] écriture base:', e.message); }
  }, 800);
}

const P = k => (db.users[k] ||= { until: 0, jid: '', warned: false, lastDays: 0, fails: [], payBan: 0, freeDay: '', freeCount: 0 });

const num = j => String(j || '').split('@')[0].split(':')[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jidOf = k => `${k}@s.whatsapp.net`;
const isOwnerNum = j => OWNERS.includes(num(j));
const watDate = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(t);
const today = () => watDate(new Date());
const fmt = ts => new Date(ts).toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'short' });
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newRef = () => {
  let r;
  do { r = 'PAY-' + Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(''); } while (db.requests[r]);
  return r;
};

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
const argsOf = mek => textOf(content(mek)).trim().split(/\s+/).slice(1);
function commandName(text) {
  for (const p of PREFIXES) {
    if (text.startsWith(p) && /^[a-z0-9]/i.test(text.slice(p.length))) return text.slice(p.length).split(/\s+/)[0].toLowerCase();
  }
  return null;
}

function keyOf(mek) {
  const k = mek.key || {};
  const cands = [k.senderPn, k.participantPn, k.participant, k.remoteJidAlt, k.remoteJid].filter(Boolean);
  return num(cands.find(j => String(j).endsWith('@s.whatsapp.net')) || cands[0]);
}
const userJid = mek => mek.key.senderPn || mek.key.participantPn || mek.key.participant || mek.key.remoteJid;
const isOwnerMsg = mek => [mek.key.senderPn, mek.key.participant, mek.key.remoteJid, mek.key.remoteJidAlt].filter(Boolean).some(isOwnerNum);

async function send(conn, jid, text) {
  try {
    await conn.sendPresenceUpdate('composing', jid);
    await sleep(700 + Math.random() * 1200);
    await conn.sendMessage(jid, { text });
  } catch (e) { console.error('[premium] envoi:', e.message); }
}

function grant(k, days) {
  const u = P(k);
  u.until = Math.max(Date.now(), u.until || 0) + days * 864e5;
  u.lastDays = days;
  u.warned = false;
  return u.until;
}
function recordFail(k) {
  const u = P(k), now = Date.now();
  u.fails = (u.fails || []).filter(t => now - t < 864e5);
  u.fails.push(now);
  if (u.fails.length >= 3) u.payBan = now + 864e5;
}
const normTx = t => String(t || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '');

// ════════════════════════ Gate ════════════════════════
let CONN = null, started = false;
const lastPrompt = new Map();

async function premiumGate(conn, mek, isOwner = false) {
  try {
    attach(conn);
    if (mek.key?.fromMe) return true;
    const name = commandName(textOf(content(mek)));
    if (!name || !db.premiumCmds.includes(name)) return true;
    if (isOwner || isOwnerMsg(mek)) return true;

    const k = keyOf(mek), u = P(k), now = Date.now();
    if (u.until > now) return true;

    if (db.freeDaily > 0) {
      if (u.freeDay !== today()) { u.freeDay = today(); u.freeCount = 0; }
      if (u.freeCount < db.freeDaily) { u.freeCount++; save(); return true; }
    }
    if (now - (lastPrompt.get(k) || 0) > 60_000) {
      lastPrompt.set(k, now);
      await conn.sendMessage(mek.key.remoteJid, {
        text: box('COMMANDE PREMIUM', [
          { raw: `${PREFIXES[0]}${name} est une commande premium.` },
          ...(db.freeDaily ? [{ raw: `(Vos ${db.freeDaily} essai(s) gratuit(s) du jour sont épuisés.)` }] : []),
          { raw: `Tapez *${PREFIXES[0]}premium* pour voir les offres.` },
        ]),
      }, { quoted: mek }).catch(() => {});
    }
    return false;
  } catch (e) {
    console.error('[premium] gate:', e.message);
    return true;
  }
}

// ════════════════════════ OCR gratuit ════════════════════════
async function ocrImage(buf) {
  if (buf.length > 5_000_000) return null;
  try {
    const form = new (require('form-data'))();
    form.append('base64Image', 'data:image/jpeg;base64,' + buf.toString('base64'));
    form.append('language', 'fra');
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', '2');
    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: 'K85471606188957' },
      body: form,
    });
    const data = await res.json();
    return data?.ParsedResults?.[0]?.ParsedText || null;
  } catch (e) { console.error('[premium] ocr:', e.message); return null; }
}

function parseReceipt(text) {
  if (!text) return null;
  const result = {
    is_payment_screenshot: /momo|orange\s*money|mobile\s*money|paiement|transfert|payment/i.test(text),
    operator: /momo|mtn/i.test(text) ? 'MTN MoMo' : /orange\s*money/i.test(text) ? 'Orange Money' : null,
    amount: null, currency: /fcfa|xaf/i.test(text) ? 'FCFA' : null,
    transaction_id: null, date: null, recipient_number: null,
    status: /succ|r[ée]ussi|success|confirm[ée]|compl[ée]/i.test(text) ? 'success' : /[ée]chec|fail|annul[ée]/i.test(text) ? 'failed' : 'unknown',
    visible_inconsistencies: [],
  };
  const amtMatch = text.match(/(\d[\d\s.,]*)\s*(fcfa|xaf)?/i);
  if (amtMatch) result.amount = parseInt(amtMatch[1].replace(/[\s.,]/g, ''), 10) || null;
  const txMatch = text.match(/(?:id|ref|transaction|r[ée]f)[^\w]*(\w{6,24})/i) || text.match(/\b([A-Z0-9]{8,24})\b/);
  if (txMatch) result.transaction_id = txMatch[1];
  const dateMatch = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.date = `${y.length === 4 ? y : '20' + y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const phoneMatch = text.match(/(?:237|00237|\+237)?\s*(6[5-9]\d{7})/);
  if (phoneMatch) result.recipient_number = '237' + phoneMatch[1];
  return result;
}

async function analyze(buf) {
  if (buf.length > 5_000_000) return null;
  const text = await ocrImage(buf);
  return text ? parseReceipt(text) : null;
}

async function download(conn, msgObj) {
  let lib = null;
  for (const name of [process.env.BAILEYS_PKG, '@whiskeysockets/baileys', 'baileys'].filter(Boolean)) {
    try { lib = await import(name); break; } catch {}
  }
  const dl = lib?.downloadMediaMessage || lib?.default?.downloadMediaMessage;
  if (!dl) throw new Error('Baileys introuvable');
  const silent = { level: 'silent', info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child() { return silent; } };
  return dl(msgObj, 'buffer', {}, { logger: silent, reuploadRequest: conn.updateMediaMessage });
}

function findImage(mek) {
  const c = content(mek);
  if (c.imageMessage) return { msg: mek, mime: c.imageMessage.mimetype };
  const ci = ctxInfo(c), img = ci?.quotedMessage?.imageMessage;
  if (img) return { mime: img.mimetype, msg: { key: { remoteJid: mek.key.remoteJid, id: ci.stanzaId, participant: ci.participant, fromMe: false }, message: { imageMessage: img } } };
  return null;
}

// ════════════════════════ 3 COMMANDES SEULEMENT ════════════════════════

// 1. .premium — statut + offres
cmd({ pattern: 'premium', desc: 'Offres premium et statut', category: 'premium', filename: __filename },
async (conn, mek, m, { reply }) => {
  const u = P(keyOf(mek)), p = PREFIXES[0];
  const plans = Object.entries(db.plans).map(([id, x]) => `• *${id}* : ${x.label} — ${x.price} ${CURRENCY}`).join('\n');
  const status = u.until > Date.now() ? `✅ Accès actif jusqu'au ${fmt(u.until)}` : '🔒 Aucun accès actif';
  reply(box('⭐ PREMIUM', [
    { raw: status },
    { blank: true },
    { raw: '*Offres*' },
    ...Object.entries(db.plans).map(([id, x]) => ({ raw: `• *${id}* : ${x.label} — ${x.price} ${CURRENCY}` })),
    { blank: true },
    { raw: '*Commandes premium*' },
    { raw: db.premiumCmds.map(c => p + c).join(', ') || '—' },
    { blank: true },
    { raw: `Acheter : *${p}pay <offre>*` },
    ...(db.freeDaily ? [{ raw: `🎁 ${db.freeDaily} essai(s) gratuit(s)/jour` }] : []),
  ]));
});

// 2. .pay — créer demande OU envoyer preuve
cmd({ pattern: 'pay', desc: 'Acheter ou envoyer preuve de paiement', category: 'premium', filename: __filename },
async (conn, mek, m, { reply }) => {
  const k = keyOf(mek), u = P(k), now = Date.now(), p = PREFIXES[0];
  const args = argsOf(mek);
  const img = findImage(mek);

  // .pay <offre> → génère la demande
  if (args[0] && db.plans[args[0].toLowerCase()] && !img) {
    if (!PAY_NUMBERS.length) return reply(box('ERROR', [{ raw: 'Paiement pas encore configuré.' }]));
    if ((u.payBan || 0) > now) return reply(box('ERROR', [{ raw: 'Demandes suspendues.' }]));
    const planId = args[0].toLowerCase(), plan = db.plans[planId];
    let req = Object.values(db.requests).find(r => r.k === k && r.status === 'awaiting' && r.expires > now);
    if (req && req.plan !== planId) { req.status = 'expired'; req = null; }
    if (!req) {
      req = { ref: newRef(), k, jid: userJid(mek), plan: planId, price: plan.price, days: plan.days,
        status: 'awaiting', created: now, expires: now + REQUEST_WINDOW_MIN * 60_000, tries: 0 };
      db.requests[req.ref] = req;
    }
    save();
    const details = box(`DEMANDE ${req.ref}`, [
      { raw: plan.label },
      { label: 'Montant', value: `${plan.price} ${CURRENCY}` },
      { blank: true },
      { raw: '*Payer à :*' },
      ...PAY_NUMBERS.map(x => ({ raw: `• ${x.label} : ${x.number}` })),
      ...(PAY_NAME ? [{ raw: `Nom : ${PAY_NAME}` }] : []),
      { blank: true },
      { raw: `Puis envoyez la *capture* avec :` },
      { raw: `*${p}pay ${req.ref} <ID transaction>*` },
    ]);
    if (mek.key.remoteJid.endsWith('@g.us')) { await send(conn, req.jid, details); return reply(box('SUCCESS', [{ raw: 'Détails envoyés en privé.' }])); }
    return reply(details);
  }

  // .pay <REF> <ID> (+ capture) → envoie la preuve
  const ref = (args[0] || '').toUpperCase();
  const txArg = args[1];
  const req = db.requests[ref];
  if (!req || req.k !== k) return reply(box('ERROR', [{ raw: `Utilisez *${p}pay <offre>* pour commencer.` }]));
  if (req.status === 'pending') return reply(box('INFO', [{ raw: 'Déjà en vérification.' }]));
  if (req.status !== 'awaiting') return reply(box('INFO', [{ raw: 'Demande déjà traitée ou expirée.' }]));
  if (req.expires < now) { req.status = 'expired'; save(); return reply(box('ERROR', [{ raw: `Expirée. Refaites *${p}pay <offre>*.` }])); }
  if (++req.tries > 3) { req.status = 'expired'; recordFail(k); save(); return reply(box('ERROR', [{ raw: 'Trop de tentatives.' }])); }

  let txId = normTx(txArg);
  if (txArg && !/^[A-Z0-9.\-]{6,24}$/.test(txId)) return reply(box('ERROR', [{ raw: 'ID invalide (6-24 caractères).' }]));
  if (!txId && !img) return reply(box('ERROR', [{ raw: `Envoyez la capture avec *${p}pay ${ref} <ID>* ou répondez à la capture.` }]));

  let buf = null, hash = null, extracted = null;
  if (img) { try { buf = await download(conn, img.msg); hash = sha256(buf); } catch {} }
  if (hash && db.usedHash[hash]) { recordFail(k); save(); return reply(box('ERROR', [{ raw: 'Capture déjà utilisée.' }])); }
  if (buf) extracted = await analyze(buf);

  const checks = [];
  if (extracted) {
    const recip = String(extracted.recipient_number || '').replace(/\D/g, '').slice(-9);
    const mine = PAY_NUMBERS.map(x => String(x.number).replace(/\D/g, '').slice(-9));
    checks.push([extracted.is_payment_screenshot !== false, 'ressemble à un reçu']);
    checks.push([extracted.status === 'success', 'statut réussi']);
    checks.push([Number(extracted.amount) >= req.price, `montant ≥ ${req.price}`]);
    checks.push([!!recip && mine.includes(recip), 'bénéficiaire correct']);
    checks.push([[today(), watDate(req.created)].includes(extracted.date), 'date du jour']);
    if ((extracted.visible_inconsistencies || []).length) checks.push([false, `incohérences : ${extracted.visible_inconsistencies.join('; ')}`]);
  }
  if (txId && db.usedTx[txId]) { recordFail(k); save(); return reply(box('ERROR', [{ raw: 'ID déjà utilisé.' }])); }

  req.status = 'pending';
  req.proof = { txId, hash, at: now, checks: checks.map(([ok, label]) => ({ ok, label })) };
  if (txId) db.usedTx[txId] = ref;
  if (hash) db.usedHash[hash] = ref;
  save();

  const allOk = checks.length > 0 && checks.every(([ok]) => ok);
  const verdict = !checks.length ? '🔎 à vérifier' : allOk ? '✅ PRÉ-VALIDÉE' : '⚠️ SUSPECTE';
  const caption = box(`PREUVE ${ref}`, [
    { label: 'Utilisateur', value: `+${k}` },
    { label: 'Offre', value: `${req.plan} ${req.price} ${CURRENCY}` },
    { label: 'ID', value: txId || '—' },
    { label: 'Pré-contrôle', value: verdict },
    ...(checks.length ? checks.map(([ok, l]) => ({ raw: `${ok ? '✅' : '❌'} ${l}` })) : []),
    { blank: true },
    { raw: `*${p}prem approve ${ref}*  ou  *${p}prem reject ${ref}*` },
  ]);
  const ownerJid = jidOf(OWNERS[0]);
  if (buf) await conn.sendMessage(ownerJid, { image: buf, caption }).catch(() => {});
  else await conn.sendMessage(ownerJid, { text: caption }).catch(() => {});
  reply(box('SUCCESS', [{ raw: 'Preuve reçue. En attente de validation.' }]));
});

// 3. .prem — gestion owner (approve, reject, pending, add, del, list, cmd, plan, free, stats)
cmd({ pattern: 'prem', desc: 'Gestion premium (owner)', category: 'premium', filename: __filename },
async (conn, mek, m, { isOwner, reply }) => {
  if (!isOwner) return reply(box('ERROR', [{ raw: 'Réservé au propriétaire.' }]));
  const [sub = 'help', ...a] = argsOf(mek);
  const now = Date.now(), p = PREFIXES[0];
  const digits = s => String(s || '').replace(/\D/g, '');

  switch (sub.toLowerCase()) {
    case 'approve': {
      const ref = (a[0] || '').toUpperCase(), req = db.requests[ref];
      if (!req) return reply(box('ERROR', [{ raw: 'Référence inconnue.' }]));
      if (req.status !== 'pending') return reply(box('INFO', [{ raw: `Statut : ${req.status}` }]));
      req.status = 'approved'; req.approvedAt = Date.now();
      const until = grant(req.k, req.days);
      P(req.k).jid = req.jid; save();
      await send(conn, req.jid, box('SUCCESS', [{ raw: `Paiement confirmé ! Accès actif jusqu'au ${fmt(until)}. 🙏` }]));
      return reply(box('SUCCESS', [{ raw: `${ref} validée : +${req.k} actif jusqu'au ${fmt(until)}.` }]));
    }
    case 'reject': {
      const ref = (a[0] || '').toUpperCase(), req = db.requests[ref];
      if (!req) return reply(box('ERROR', [{ raw: 'Référence inconnue.' }]));
      if (req.status !== 'pending') return reply(box('INFO', [{ raw: `Statut : ${req.status}` }]));
      req.status = 'rejected';
      if (req.proof?.txId) delete db.usedTx[req.proof.txId];
      if (req.proof?.hash) delete db.usedHash[req.proof.hash];
      recordFail(req.k); save();
      const motif = a.slice(1).join(' ').trim();
      await send(conn, req.jid, box('ERROR', [{ raw: `Paiement ${ref} non confirmé${motif ? ` : ${motif}` : ''}.` }]));
      return reply(box('ERROR', [{ raw: `${ref} refusée.` }]));
    }
    case 'pending': {
      const list = Object.values(db.requests).filter(r => r.status === 'pending');
      return reply(list.length
        ? box('EN ATTENTE', [
            { raw: `(${list.length})` },
            ...list.map(r => ({ raw: `• ${r.ref} — +${r.k} — ${r.plan} ${r.price} ${CURRENCY}` })),
          ])
        : box('SUCCESS', [{ raw: 'Aucun paiement en attente.' }]));
    }
    case 'add': {
      const n = digits(a[0]), d = Number(a[1]);
      if (n.length < 6 || !(d > 0)) return reply(box('ERROR', [{ raw: `Usage : *${p}prem add <num> <jours>*` }]));
      P(n).jid = jidOf(n);
      return reply(box('SUCCESS', [{ raw: `+${n} : accès jusqu'au ${fmt(grant(n, d))}` }]));
    }
    case 'del': {
      const n = digits(a[0]);
      if (!db.users[n]) return reply(box('ERROR', [{ raw: 'Numéro inconnu.' }]));
      db.users[n].until = 0;
      return reply(box('SUCCESS', [{ raw: `Accès de +${n} retiré.` }]));
    }
    case 'list': {
      const act = Object.entries(db.users).filter(([, u]) => u.until > now).sort((x, y) => x[1].until - y[1].until);
      return reply(act.length
        ? box('ABONNÉS', [
            { raw: `(${act.length})` },
            ...act.slice(0, 30).map(([k, u]) => ({ raw: `• +${k} → ${fmt(u.until)}` })),
          ])
        : box('INFO', [{ raw: 'Aucun abonné.' }]));
    }
    case 'cmd': {
      const action = (a[0] || '').toLowerCase();
      const names = a.slice(1).map(x => x.toLowerCase().replace(/^[^a-z0-9]+/, '')).filter(Boolean);
      if (action === 'list' || !action) return reply(box('COMMANDES PREMIUM', [
        ...db.premiumCmds.map(c => ({ raw: p + c })),
      ]));
      if (!names.length) return reply(box('ERROR', [{ raw: `Usage : *${p}prem cmd add|del <nom>*` }]));
      if (action === 'add') {
        const bad = names.filter(x => RESERVED.has(x));
        if (bad.length) return reply(box('ERROR', [{ raw: `Jamais premium : ${bad.join(', ')}` }]));
        db.premiumCmds = [...new Set([...db.premiumCmds, ...names])];
      } else if (action === 'del') {
        db.premiumCmds = db.premiumCmds.filter(c => !names.includes(c));
      } else return reply(box('ERROR', [{ raw: `Usage : *${p}prem cmd add|del|list*` }]));
      return reply(box('SUCCESS', [
        { raw: `Premium : ${db.premiumCmds.map(c => p + c).join(', ') || '—'}` },
      ]));
    }
    case 'plan': {
      const id = (a[0] || '').toLowerCase(), price = Number(a[1]), days = a[2] ? Number(a[2]) : null;
      if (!id || !(price > 0)) return reply(box('ERROR', [{ raw: `Usage : *${p}prem plan <id> <prix> [jours]*` }]));
      if (db.plans[id]) { db.plans[id].price = price; if (days > 0) db.plans[id].days = days; }
      else if (days > 0) db.plans[id] = { label: `Accès ${days}j`, days, price };
      else return reply(box('ERROR', [{ raw: 'Nouvelle offre : précisez la durée.' }]));
      return reply(box('SUCCESS', [
        { label: id, value: `${db.plans[id].price} ${CURRENCY} / ${db.plans[id].days}j` },
      ]));
    }
    case 'free': {
      const n = Number(a[0]);
      if (!Number.isInteger(n) || n < 0) return reply(box('ERROR', [{ raw: `Usage : *${p}prem free <n>* (0 = désactivé)` }]));
      db.freeDaily = n;
      return reply(box('SUCCESS', [{ raw: `Essais gratuits/jour : ${n || 'aucun'}` }]));
    }
    case 'stats': {
      const ok = Object.values(db.requests).filter(r => r.status === 'approved');
      const sum = arr => arr.reduce((s, r) => s + r.price, 0);
      const t = ok.filter(r => watDate(r.approvedAt) === today());
      const m30 = ok.filter(r => now - r.approvedAt < 30 * 864e5);
      return reply(box('📊 VENTES', [
        { label: "Aujourd'hui", value: `${t.length} — ${sum(t)} ${CURRENCY}` },
        { label: '30j', value: `${m30.length} — ${sum(m30)} ${CURRENCY}` },
        { label: 'Total', value: `${ok.length} — ${sum(ok)} ${CURRENCY}` },
        { label: 'Actifs', value: Object.values(db.users).filter(u => u.until > now).length },
      ]));
    }
    default:
      return reply(box(`${p}prem`, [
        { raw: `• approve <ref> · reject <ref> · pending` },
        { raw: `• add <num> <jours> · del <num> · list` },
        { raw: `• cmd add|del|list <nom>` },
        { raw: `• plan <id> <prix> [jours] · free <n> · stats` },
      ]));
  }
});

// ════════════════════════ Maintenance ════════════════════════
function attach(conn) {
  CONN = conn;
  if (started) return;
  started = true;
  setInterval(() => CONN && maintenance(CONN).catch(e => console.error('[premium] maintenance:', e.message)), 5 * 60_000);
}

async function maintenance(conn) {
  const now = Date.now();
  for (const r of Object.values(db.requests)) {
    if (r.status === 'awaiting' && r.expires < now) r.status = 'expired';
    if (['awaiting', 'expired', 'rejected'].includes(r.status) && now - r.created > 30 * 864e5) delete db.requests[r.ref];
  }
  for (const [k, u] of Object.entries(db.users)) {
    if (u.until > now && u.until - now < 864e5 && !u.warned && u.lastDays > 1) {
      u.warned = true;
      await send(conn, u.jid || jidOf(k), box('⏰ RAPPEL', [
        { raw: `Votre accès premium expire le ${fmt(u.until)}.` },
        { raw: `Renouvelez avec *${PREFIXES[0]}pay <offre>*.` },
      ]));
    }
  }
  save();
}

module.exports = { premiumGate };
