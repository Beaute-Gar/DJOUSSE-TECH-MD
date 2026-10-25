'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — famille « auto & présence »
 * ──────────────────────────────────────────────────────────────────
 * alwaysonline · autotyping · autorecord · autobio · autodlstatus
 * autoreply · pmpermit
 *
 * PORTÉ AVEC LE STYLE DJOUSE (cmd(), buildFrame, ctx.success/…).
 * Le cœur de TEDDY étant obfusqué, le mécanisme est réimplémenté avec
 * les voies officielles Baileys : sock.sendPresenceUpdate() et
 * sock.updateProfileStatus() (vérifiés dans lib/Socket/chats.js).
 * Aucune commande « coquille » : chaque état pilote un effet réel.
 * ══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

/* Réglage par défaut (persisté dans state.settings.portedAuto) */
const DEFAULT = {
  alwaysonline: false,
  autotyping: false,
  autorecord: false,
  autobio: false,
  autobioText: '',
  autodlstatus: false,
  autoreply: false,
  autoreplyText: 'Message automatique DJOUSSE TECH ✅',
  pmpermit: false,
};

/* état module */
let onlineTimer = null;
let lastAvailable = 0;
/* injecté par registerPortedAuto : évite un require circulaire */
let sendFn = null;

function onOff(v) { return v ? 'ON ✅' : 'OFF ❌'; }

function registerPortedAuto(cmd, deps) {
  const { config, saveState, getSettings, setSettings, downloadFrom, mediaInfo, send, buildFrame, bullet } = deps;
  sendFn = send;

  /* ── alwaysonline ─────────────────────────────────────────────── */
  cmd('alwaysonline', { cat: 9, desc: 'Rester en ligne en permanence', usage: 'alwaysonline on|off', owner: true, icon: '🟢' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}ALWAYSONLINE ON|OFF`]);
    const s = { ...getSettings(), alwaysonline: v === 'on' };
    setSettings(s);
    /* timer réel, unref'd : pas de fuite au redémarrage */
    if (s.alwaysonline) startOnlineTimer(c.sock);
    else stopOnlineTimer();
    saveState();
    return c.success(['TOUJOURS EN LIGNE', onOff(s.alwaysonline)]);
  });

  /* ── autotyping ───────────────────────────────────────────────── */
  cmd('autotyping', { cat: 9, desc: 'Afficher « en train d\'écrire » sur les messages reçus', usage: 'autotyping on|off', owner: true, icon: '⌨️' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}AUTOTYPING ON|OFF`]);
    const s = { ...getSettings(), autotyping: v === 'on' };
    if (s.autotyping) s.autorecord = false; // les deux présences s'excluent
    setSettings(s); saveState();
    return c.success(['SAISIE AUTOMATIQUE', onOff(s.autotyping)]);
  });

  /* ── autorecord ───────────────────────────────────────────────── */
  cmd('autorecord', { cat: 9, desc: 'Afficher « en train d\'enregistrer » sur les messages reçus', usage: 'autorecord on|off', owner: true, icon: '🎙️' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}AUTORECORD ON|OFF`]);
    const s = { ...getSettings(), autorecord: v === 'on' };
    if (s.autorecord) s.autotyping = false;
    setSettings(s); saveState();
    return c.success(['ENREGISTREMENT AUTO', onOff(s.autorecord)]);
  });

  /* ── autobio ──────────────────────────────────────────────────── */
  cmd('autobio', { cat: 9, desc: 'Changer la bio du bot', usage: 'autobio on|off <texte>', owner: true, icon: '📝' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v === 'on' || v === 'off') {
      const s = { ...getSettings(), autobio: v === 'on' };
      if (v === 'on') s.autobioText = c.args.slice(1).join(' ').trim() || s.autobioText || 'DJOUSSE TECH';
      setSettings(s); saveState();
      if (s.autobio) await applyBio(c.sock, s.autobioText);
      return c.success(['BIO AUTOMATIQUE', `${onOff(s.autobio)} — ${s.autobioText}`]);
    }
    /* forme courte : .autobio <texte> directement */
    const txt = c.q.trim();
    if (!txt) return c.error(['USAGE', `${config.prefix}AUTOBIO ON|OFF [TEXTE]`]);
    const s = { ...getSettings(), autobio: true, autobioText: txt.slice(0, 139) };
    setSettings(s); saveState();
    await applyBio(c.sock, txt);
    return c.success(['BIO MISE À JOUR', txt.slice(0, 139)]);
  });

  /* ── autodlstatus : sauvegarde les médias des statuts ─────────── */
  cmd('autodlstatus', { cat: 9, desc: 'Sauvegarder les médias des statuts reçus', usage: 'autodlstatus on|off', owner: true, icon: '📥' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}AUTODLSTATUS ON|OFF`]);
    const s = { ...getSettings(), autodlstatus: v === 'on' };
    setSettings(s); saveState();
    return c.success(['TÉLÉCHARGEMENT DES STATUTS', onOff(s.autodlstatus)]);
  });

  /* ── autoreply ────────────────────────────────────────────────── */
  cmd('autoreply', { cat: 9, desc: 'Réponse automatique aux messages privés', usage: 'autoreply on|off [texte]', owner: true, icon: '💬' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v === 'on' || v === 'off') {
      const s = { ...getSettings(), autoreply: v === 'on' };
      const txt = c.args.slice(1).join(' ').trim();
      if (txt) s.autoreplyText = txt.slice(0, 500);
      setSettings(s); saveState();
      return c.success(['RÉPONSE AUTOMATIQUE', `${onOff(s.autoreply)} — « ${s.autoreplyText} »`]);
    }
    if (c.q.trim()) { /* .autoreply <texte> → active avec ce texte */
      const s = { ...getSettings(), autoreply: true, autoreplyText: c.q.trim().slice(0, 500) };
      setSettings(s); saveState();
      return c.success(['RÉPONSE AUTOMATIQUE', onOff(true)]);
    }
    return c.error(['USAGE', `${config.prefix}AUTOREPLY ON|OFF [TEXTE]`]);
  });

  /* ── pmpermit ─────────────────────────────────────────────────── */
  cmd('pmpermit', { cat: 9, desc: 'Avertir les inconnus qui écrivent en privé', usage: 'pmpermit on|off', owner: true, icon: '🚪' }, async (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') return c.error(['USAGE', `${config.prefix}PMPERMIT ON|OFF`]);
    const s = { ...getSettings(), pmpermit: v === 'on' };
    setSettings(s); saveState();
    return c.success(['AVERTISSEMENT INCONNUS', onOff(s.pmpermit)]);
  });

  /* ── état récapitulatif ───────────────────────────────────────── */
  cmd('autosettings', { cat: 9, desc: 'Voir tous les réglages auto', usage: 'autosettings', owner: true, icon: '⚙️' }, async (c) => {
    const s = { ...DEFAULT, ...getSettings() };
    return c.reply(buildFrame('RÉGLAGES AUTO', [
      bullet('TOUJOURS EN LIGNE', onOff(s.alwaysonline)),
      bullet('SAISIE AUTO', onOff(s.autotyping)),
      bullet('ENREGISTREMENT AUTO', onOff(s.autorecord)),
      bullet('BIO', `${onOff(s.autobio)} — ${s.autobioText || '—'}`),
      bullet('TÉLÉCH. STATUTS', onOff(s.autodlstatus)),
      bullet('RÉPONSE AUTO', `${onOff(s.autoreply)} — « ${s.autoreplyText} »`),
      bullet('AVERT. INCONNUS', onOff(s.pmpermit)),
    ]));
  });
}

/* ══════════════ moteur ══════════════ */

async function applyBio(sock, text) {
  try { if (sock && typeof sock.updateProfileStatus === 'function') await sock.updateProfileStatus(String(text).slice(0, 139)); }
  catch (e) { console.error('[AUTO] bio:', e.message); }
}

function startOnlineTimer(sock) {
  stopOnlineTimer();
  const tick = async () => {
    const now = Date.now();
    if (now - lastAvailable < 45000) return; // throttle interne
    lastAvailable = now;
    try { if (sock && typeof sock.sendPresenceUpdate === 'function') await sock.sendPresenceUpdate('available'); }
    catch { /* silencieux : WhatsApp coupe parfois la présence */ }
  };
  void tick();
  onlineTimer = setInterval(tick, 45000);
  onlineTimer.unref?.(); // ne doit JAMAIS garder le process en vie
}

function stopOnlineTimer() {
  if (onlineTimer) { clearInterval(onlineTimer); onlineTimer = null; }
}

/* Appelé par handler.handleMessage() pour chaque message entrant.
   ctx : { sock, text, isCommand, fromMe, from, sender, isGroup,
           isOwner, settings, msg, downloadMedia } */
async function onMessage(ctx) {
  const s = { ...DEFAULT, ...(ctx.settings || {}) };
  const sock = ctx.sock;

  /* 1. présence : imite la frappe / l'enregistrement */
  if (!ctx.fromMe && sock && typeof sock.sendPresenceUpdate === 'function') {
    if (s.autotyping) {
      sock.sendPresenceUpdate('composing', ctx.from).catch(() => {});
      setTimeout(() => sock.sendPresenceUpdate?.('paused', ctx.from).catch(() => {}), 4000).unref?.();
    } else if (s.autorecord) {
      sock.sendPresenceUpdate('recording', ctx.from).catch(() => {});
      setTimeout(() => sock.sendPresenceUpdate?.('paused', ctx.from).catch(() => {}), 4000).unref?.();
    }
  }

  /* 2. réponse auto (MP uniquement, jamais sur commande ni sur soi) */
  if (s.autoreply && !ctx.isCommand && !ctx.fromMe && !ctx.isGroup) {
    try { if (sendFn) await sendFn(sock, ctx.from, { text: s.autoreplyText }); } catch {}
  }

  /* 3. avertissement inconnus en MP (pas de blocage auto : trop risqué) */
  if (s.pmpermit && !ctx.isCommand && !ctx.fromMe && !ctx.isGroup && !ctx.isOwner) {
    const num = String(ctx.sender || '').replace(/\D/g, '');
    if (num && !(ctx.knownSenders || new Set()).has(num)) {
      try {
        if (sendFn) await sendFn(sock, ctx.from, {
          text: '🚪 DJOUSSE TECH — message privé non autorisé.\nPrésente-toi : nom + motif. Le propriétaire te répondra.',
        });
      } catch {}
    }
  }
}

/* Appelé par handler.handleStatus() pour les statuts reçus */
async function onStatus(ctx) {
  const s = { ...DEFAULT, ...(ctx.settings || {}) };
  if (!s.autodlstatus) return;
  try {
    const info = ctx.mediaInfo ? ctx.mediaInfo(ctx.msg) : null;
    if (!info || !ctx.downloadFrom) return;
    const buf = await ctx.downloadFrom(ctx.sock, info);
    const dir = path.join(process.cwd(), 'storage', 'downloads', 'statuts');
    fs.mkdirSync(dir, { recursive: true });
    const ext = String(info.mimetype || 'bin').split('/')[1]?.split(';')[0] || 'bin';
    const file = path.join(dir, `statut_${Date.now()}.${ext}`);
    fs.writeFileSync(file, buf);
    console.log(`[AUTO] statut sauvegardé : ${file}`);
  } catch (e) {
    console.error('[AUTO] sauvegarde statut:', e.message);
  }
}

function autoSettings(settings) { return { ...DEFAULT, ...(settings || {}) }; }

module.exports = {
  registerPortedAuto,
  onMessage,
  onStatus,
  startOnlineTimer,
  stopOnlineTimer,
  applyBio,
  autoSettings,
  DEFAULT,
};
