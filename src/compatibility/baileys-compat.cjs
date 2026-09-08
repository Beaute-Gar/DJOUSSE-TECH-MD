/* BaileysCompatibilityLayer — SHIM hérité pour les plugins qui parlent encore
   le langage Baileys (conn, m.quoted.msg.*, downloadMediaMessage...).
   Ré-exporte le shim existant (lib/wwebjs-msg.cjs) + scanner de dépendances
   + classification + résumé registry pour le boot et /sante. */

const fs = require('fs');
const path = require('path');

const { sms, downloadMediaMessage, wrapBox, getContentType } = require('../../lib/wwebjs-msg.cjs');

/* ══ Shims Baileys toujours supportés (traduits vers wwebjs) ══ */
const grud_base = {};
const baileysPolyfills = {
  downloadContentFromMessage: () => null,
  toBuffer: () => null,
  jidDecode: (jid) => String(jid || '').match(/^(\d+|[a-z0-9_@.-]+)@(\w+)/) ? { user: RegExp.$1, server: RegExp.$2 } : null,
  jidNormalizedUser: (jid) => String(jid || '').split(':')[0].split('@')[0] + '@' + (String(jid).includes('@g.us') ? 'g.us' : 's.whatsapp.net'),
  areJidsSameUser: (a, b) => String(a || '').split('@')[0] === String(b || '').split('@')[0],
};

/* ══ Scanner de dépendances des plugins ══ */
const BAILEYS_SIG = [
  /@whiskeysockets\/baileys/,
  /makeWASocket\s*\(/,
  /useMultiFileAuthState\s*\(/,
  /useSingleFileAuthState\s*\(/,
  /downloadContentFromMessage\s*\(|\bdownloadContentFromMessage\b/,
  /generateWAMessage\s*\(/,
  /proto\./,
  /getBinaryNodeChild\s*\(/,
];

const SOCK_USAGE_SIG = [
  /conn\.sendMessage|sock\.sendMessage|\bsock\[/,
  /conn\.loadMessages|conn\.groupMetadata|conn\.groupParticipantsUpdate/,
];

const MEDIA_SIG = [
  /downloadMediaMessage/,
  /\.downloadMedia\(/,
  /\bhasMedia\b/,
  /content\.(image|video|audio|sticker|document)\b/,
  /m\.quoted/,
  /replyImg|replyAud|replySticker|replyDoc|replyVid|replyTxt/,
  /\.mimetype/,
];

const BIZ_SIG = [
  /(?:conn|sock|client)\.(?:getProductCatalog|requestPayment|addProduct|idk).*\s*\(/,
  /pairCode\s*\(/,
  /(?:conn|sock|client)\.\w*[tT]wo[Ss]tep\w*\s*\(/,
];

/* ══ Helper registerPluginLocal pour les plugins legacy ══ */
const registerPlugin = (data) => data;

function _obfuscated(file) {
  try {
    const src = fs.readFileSync(file, 'utf8');
    return /(_0x[a-fA-F0-9]{4,})|(function\s+_0x|_0x[0-9a-f]{3,}\s*=\s*function)/.test(src.slice(0, 4000));
  } catch (e) {
    return false;
  }
}

function readSource(file) {
  if (!file || file === 'Not Provided' || file === 'undefined') return '';
  try {
    return fs.readFileSync(path.resolve(file), 'utf8');
  } catch (e) {
    return '';
  }
}

function scanPluginSource(file) {
  const src = readSource(file);
  if (!src) return { baileys: false, sockUsage: false, media: false, business: false, obfuscated: false };
  return {
    baileys: BAILEYS_SIG.some(r => r.test(src)),
    sockUsage: SOCK_USAGE_SIG.some(r => r.test(src)),
    media: MEDIA_SIG.some(r => r.test(src)),
    business: BIZ_SIG.some(r => r.test(src)),
    obfuscated: _obfuscated(file),
  };
}

function classifyCommand(command) {
  const file = command && command.filename;
  const name = String((command && command.pattern) || '').toLowerCase();
  const category = String((command && command.category) || 'misc').toLowerCase();

  if (['catalogue', 'pair-owner', 'pay', 'product', 'twostep'].includes(name)) {
    return { name, category, engine: 'independent', status: 'incompatible', obfuscated: false, requires: ['business', '2fa'] };
  }

  const sig = scanPluginSource(file);
  const requires = [];
  if (sig.media) requires.push('quotedMessage', 'media');
  const hasBaileys = sig.baileys;

  let engine = 'independent';
  if (hasBaileys && sig.media) engine = 'mixed';
  else if (hasBaileys) engine = 'baileys';
  else if (sig.sockUsage) engine = 'wwebjs';

  let status = 'native';
  if (sig.business) status = 'incompatible';
  else if (hasBaileys && sig.media) status = 'legacy';
  else if (hasBaileys) status = 'legacy';
  else if (sig.media && sig.sockUsage) status = 'adapter';
  else if (sig.media) status = 'adapter';

  return {
    name,
    category,
    engine,
    status,
    obfuscated: sig.obfuscated,
    requires: requires.length ? requires : ['sendText'],
  };
}

function describeCommand(command) {
  const base = classifyCommand(command);
  return {
    name: String((command && command.pattern) || '').toLowerCase(),
    category: String((command && command.category) || 'misc').toLowerCase(),
    engine: base.engine,
    status: base.status,
    obfuscated: base.obfuscated,
    requires: base.requires,
  };
}

function summarizeRegistry(commands) {
  const list = Array.isArray(commands) ? commands : [];
  const byEngine = { wwebjs: 0, baileys: 0, mixed: 0, independent: 0 };
  const byStatus = { native: 0, adapter: 0, legacy: 0, incompatible: 0 };
  const metaByStatus = { native: [], adapter: [], legacy: [], incompatible: [] };

  for (const c of list) {
    if (!c.pattern || c.pattern.toString().includes('/')) continue;
    const meta = describeCommand(c);
    if (c.meta === undefined) { try { c.meta = meta; } catch (e) {} }
    byEngine[meta.engine] = (byEngine[meta.engine] || 0) + 1;
    byStatus[meta.status] = (byStatus[meta.status] || 0) + 1;
    if (metaByStatus[meta.status]) metaByStatus[meta.status].push(meta.name);
  }

  return {
    total: list.length,
    byEngine,
    byStatus,
    metaByStatus,
  };
}

function printRegistrySummary(commands) {
  const s = summarizeRegistry(commands);
  const lines = [
    '🔎 ANALYSE DES DÉPENDANCES',
    `${s.total} commandes analysées`,
    '──────────────',
  ];
  for (const [engine, n] of Object.entries(s.byEngine)) {
    lines.push(`${engine.padEnd(11)} ${n}`);
  }
  lines.push('──────────────');
  const statusLabel = { native: '🟢 native', adapter: '🟡 adapter', legacy: '🟠 legacy', incompatible: '⚫ incompatible' };
  for (const [st, n] of Object.entries(s.byStatus)) {
    lines.push(`${statusLabel[st] || st.padEnd(8)} ${n}`);
  }
  return lines.join('\n');
}

module.exports = {
  sms,
  downloadMediaMessage,
  wrapBox,
  getContentType,
  baileysPolyfills,
  registerPlugin,
  scanPluginSource,
  classifyCommand,
  describeCommand,
  summarizeRegistry,
  printRegistrySummary,
};