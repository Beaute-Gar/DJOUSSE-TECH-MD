'use strict';
/**
 * Banc d'essai : charge le VRAI handler.js avec des faux modules lourds (sharp, ffmpeg…)
 * et un faux socket Baileys qui enregistre tout ce que le bot envoie.
 */
const Module = require('module');
const os = require('os');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'));

const BOT = '237600000000';
const OWNER = '237699000000';
const MEMBER = '237622222222';
const jid = (n) => n + '@s.whatsapp.net';

process.env.OWNER_NUMBER = OWNER;
process.env.PREFIX = '.';
process.env.ANTI_DELETE = 'false'; // le .env du dépôt met true : les tests partent de la valeur par défaut
process.env.SESSION_DIR = path.relative(ROOT, TMP); // état de test hors du projet
process.env.GUARD_TZ = 'Africa/Douala';
// Le pont Vigil ne doit JAMAIS appeler le réseau pendant les tests :
// on coupe ici, avant que config.js lise .env. tests/vigil.test.js le
// réactive en mémoire, test par test, avec un faux fetch.
process.env.VIGIL_URL = '';
process.env.VIGIL_EMAIL = '';
process.env.VIGIL_PASSWORD = '';
/* Commutateur QR/Pairing (.menu qr|pairing) : le vrai .env du dépôt ne
   doit JAMAIS être réécrit pendant les tests — on le redirige vers le
   dossier temporaire, avec un fichier d'amorçage qui contient un secret
   pour vérifier que les autres lignes sont recopiées octet à octet. */
process.env.ENV_FILE = path.join(TMP, '.env');
fs.writeFileSync(process.env.ENV_FILE,
  'BOT_NAME=DJOUSSE-TECH-MD\n'
  + 'PREFIX=.\n'
  + 'DATABASE_URL=postgresql://neondb_owner:SUPER_SECRET@ep-x/neondb?sslmode=require&channel_binding=require\n'
  + 'CONNECT_METHOD=\n'
  + 'PAIRING_PHONE=\n', 'utf8');

const STUBS = {
  sharp: () => ({}),
  // Fabrique de stickers interne (lot B11) : on stub le module handler.js
  // pour éviter de charger sharp/node-webpmux réels dans ce processus de test.
  './lib/wa-sticker': {
    Sticker: class { async toBuffer() { return Buffer.from('RIFF0000WEBPfake'); } },
    StickerTypes: { FULL: 'full', DEFAULT: 'default', CROPPED: 'crop', CIRCLE: 'circle', ROUNDED: 'rounded' },
  },
  mathjs: { evaluate: (x) => eval(x) }, // eslint-disable-line no-eval
  qrcode: {},
  '@vitalets/google-translate-api': { translate: async () => ({ text: '' }) },
  'yt-search': async () => ({ videos: [] }),
  'ffmpeg-static': '/nonexistent/ffmpeg',
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) return STUBS[request];
  return origLoad.call(this, request, ...rest);
};

const guardDb = require('../guard/src/db');
const guardPerms = require('../guard/src/utils/perms');
const guardEngine = require('../guard/src/engine');
const handler = require('../handler');

let adminSeq = 0;
/** Un admin neuf par test (le handler limite à 10 commandes / 10 s / expéditeur). */
const newAdmin = () => '23761100' + String(++adminSeq).padStart(4, '0');

function mockSock({ botAdmin = true, admins = [], extra = [] } = {}) {
  const sent = [], removed = [], settings = [];
  const meta = (gid) => ({
    id: gid, subject: 'Groupe Test',
    participants: [
      ...admins.map((a) => ({ id: jid(a), admin: 'admin' })),
      { id: jid(BOT), admin: botAdmin ? 'admin' : null },
      { id: jid(MEMBER), admin: null },
      ...extra,
    ],
  });
  return {
    user: { id: BOT + ':7@s.whatsapp.net' },
    sent, removed, settings,
    groupMetadata: async (gid) => meta(gid),
    sendMessage: async (to, content) => { sent.push({ to, ...content }); return {}; },
    groupParticipantsUpdate: async (gid, ids, action) => { if (action === 'remove') removed.push(...ids); return []; },
    groupSettingUpdate: async (gid, v) => { settings.push(v); },
    sendPresenceUpdate: async () => {},
    presenceSubscribe: async (j) => { settings.push('sub:' + j); },
    logout: async () => { settings.push('logout'); },
    removeProfilePicture: async () => { settings.push('rpp'); },
    fetchBlocklist: async () => [],
    groupFetchAllParticipating: async () => ({}),
    updateLastSeenPrivacy: async (v) => { settings.push('privacy:lastseen=' + v); },
    readMessages: async () => {},
    profilePictureUrl: async () => { throw new Error('no picture'); },
    /* Lot B14 : channels (rappels de métadonnées), favoris, bots liés */
    newsletterMetadata: async (_type, id) => ({ id, name: 'Canal Test', description: 'Desc test', subscribersCount: 42 }),
    newsletterUpdateName: async (id, name) => { settings.push('chname=' + name); },
    star: async (_j, _msgs, on) => { settings.push('star=' + on); },
    getBotListV2: async () => ([{ jid: '237655555555@s.whatsapp.net', botName: 'Bot Test' }]),
  };
}

let n = 0;
function msg(gid, sender, message, key = {}) {
  return { key: { remoteJid: gid, participant: jid(sender), id: 'M' + ++n, fromMe: false, ...key }, message };
}
const text = (gid, sender, t) => msg(gid, sender, { conversation: t });

function fresh(gid) {
  guardDb.init(path.join(TMP, 'guard-' + ++n + '.json'));
  handler.state.groups = {};
  handler.state.blacklist = [];
  handler.state.settings.selfMode = false;
  [].concat(gid || []).forEach((g) => guardPerms.invalidate(g));
  guardEngine._notified.clear();
  for (const k of ['antispam', 'antiflood']) require('../guard/src/protections/' + k)._reset();
}

const plain = (s) => String(s || '').normalize('NFKC'); // alphabet officiel → ASCII pour les assertions
const deleted = (s) => s.sent.filter((m) => m.delete);
const texts = (s) => s.sent.filter((m) => m.text).map((m) => plain(m.text));

module.exports = { handler, guardDb, guardPerms, guardEngine, mockSock, msg, text, fresh, newAdmin, plain, deleted, texts, jid, BOT, OWNER, MEMBER, TMP };
