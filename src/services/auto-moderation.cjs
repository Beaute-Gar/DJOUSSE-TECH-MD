/**
 * Auto-Moderation — DJOUSSE-TECH-MD
 *
 * Anti-spam (flood) et anti-lien WhatsApp. Activé/désactivé par groupe via
 * .antispam et .antilink. État en mémoire (Map, pas disque).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RÈGLE DE ROUTING : toutes les fonctions reçoivent `m` déjà traité par sms()
 * (m.chat / m.sender / m.reply). Jamais de recalcul depuis msg.key.remoteJid.
 * ══════════════════════════════════════════════════════════════════════════
 */

const dataDir = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'moderation-settings.json');

/* ─── État en mémoire ─── */
const floodCounters = new Map();   // chatJid → [timestamps]
const settings = new Map();        // chatJid → { antispam, antilink }

/* ─── Params ─── */
const FLOOD_WINDOW_MS  = 8000;     // 8 secondes
const FLOOD_MAX_MSGS   = 6;        // > 6 messages en 8s → spam
const LINK_REGEX       = /chat\.whatsapp\.com\/[A-Za-z0-9]+/i;

/* ─── Persistance (optionnelle) ─── */
function loadSettings() {
  try {
    if (dataDir.existsSync(SETTINGS_FILE)) {
      const raw = dataDir.readFileSync(SETTINGS_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [jid, val] of Object.entries(obj)) settings.set(jid, val);
    }
  } catch { /* first run — ignore */ }
}

function saveSettings() {
  try {
    dataDir.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    const obj = Object.fromEntries(settings);
    dataDir.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('[MODERATION] saveSettings:', e.message);
  }
}

/* ─── Core ─── */
function getSettings(chatJid) {
  if (!settings.has(chatJid)) settings.set(chatJid, { antispam: false, antilink: false });
  return settings.get(chatJid);
}

function toggle(chatJid, key) {
  const s = getSettings(chatJid);
  s[key] = !s[key];
  saveSettings();
  return s[key];
}

function checkFlood(chatJid) {
  const now = Date.now();
  if (!floodCounters.has(chatJid)) floodCounters.set(chatJid, []);
  const times = floodCounters.get(chatJid);
  times.push(now);
  while (times.length && times[0] < now - FLOOD_WINDOW_MS) times.shift();
  return times.length > FLOOD_MAX_MSGS;
}

function containsLink(text) {
  return LINK_REGEX.test(String(text || ''));
}

/**
 * Inspecte un message (appelé depuis index.cjs avant exécution du plugin).
 * Retourne un tableau non vide de suppressions si le message doit être bloqué,
 * ou [] si tout est OK.
 */
async function inspect(sock, m, msg) {
  const actions = [];

  // Ignore les admins / owners
  if (m.isOwner || m.isAdmin) return [];

  const s = getSettings(m.chat);

  // Anti-spam flood
  if (s.antispam && checkFlood(m.chat)) {
    actions.push('spam');
    try {
      const chatMetadata = await sock.groupMetadata(m.chat).catch(() => null);
      if (chatMetadata && chatMetadata.participants) {
        const botParticipant = chatMetadata.participants.find(p => p.id === sock.user?.id?.replace(/:\d+/, ''));
        if (botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin') {
          await sock.sendMessage(m.chat, { delete: msg.key }).catch(() => {});
          await sock.sendMessage(m.chat, {
            text: `⚠️ @${m.sender.split('@')[0]}, flood détecté (> ${FLOOD_MAX_MSGS} msgs en ${FLOOD_WINDOW_MS / 1000}s). Message supprimé.`,
            mentions: [m.sender],
          });
        }
      }
    } catch (e) {
      console.error('[MODERATION] flood delete:', e.message);
    }
  }

  // Anti-lien
  if (s.antilink && containsLink(m.body || m.text || '')) {
    actions.push('lien');
    try {
      const chatMetadata = await sock.groupMetadata(m.chat).catch(() => null);
      if (chatMetadata && chatMetadata.participants) {
        const botParticipant = chatMetadata.participants.find(p => p.id === sock.user?.id?.replace(/:\d+/, ''));
        if (botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin') {
          await sock.sendMessage(m.chat, { delete: msg.key }).catch(() => {});
          await sock.sendMessage(m.chat, {
            text: `⚠️ @${m.sender.split('@')[0]}, lien WhatsApp détecté. Message supprimé.`,
            mentions: [m.sender],
          });
        }
      }
    } catch (e) {
      console.error('[MODERATION] link delete:', e.message);
    }
  }

  return actions;
}

module.exports = {
  loadSettings,
  saveSettings,
  getSettings,
  toggle,
  inspect,
  /** Pour les tests */
  _checkFlood: checkFlood,
  _containsLink: containsLink,
  _floodCounters: floodCounters,
  _settings: settings,
};
