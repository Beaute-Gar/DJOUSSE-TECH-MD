'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — famille « groupe »
 * ──────────────────────────────────────────────────────────────────
 * antibot · automute · autounmute · tagadmin · groupcron
 *
 * Le cron de fermeture/ouverture est réimplémenté sans dépendance
 * (setInterval 60 s, unref'd) et persisté dans state.settings.portedGroup.
 * Le cœur de TEDDY étant obfusqué, rien n'est recopié : seules les
 * fonctions sont reproduites, avec les styles DJOUSE.
 * ══════════════════════════════════════════════════════════════════
 */

const DEFAULT = {
  antibot: {},        // { '<jid>': 'on' }
  antibotAction: {},  // { '<jid>': 'remove'|'warn'|'delete' }
  muteAt: {},         // { '<jid>': 'HH:MM' }
  unmuteAt: {},       // { '<jid>': 'HH:MM' }
};

/* état module */
let cronTimer = null;
let warnHook = null; // injecté : (jid, participant, raison) => Promise

function hhmm(v) {
  const m = String(v || '').match(/^(\d{1,2})[:hH](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function registerPortedGroup(cmd, deps) {
  const {
    config, saveState, getSettings, setSettings, buildFrame, bullet, send, setWarnHook,
  } = deps;
  if (typeof setWarnHook === 'function') setWarnHook((jid, part, raison) => warnHook?.(jid, part, raison));

  /* ── antibot ──────────────────────────────────────────────────── */
  cmd('antibot', { cat: 3, desc: 'Anti-bot : vire/avertit les bots qui entrent', usage: 'antibot on|off|action/remove|warn|delete', group: true, admin: true, icon: '👾' }, async (c) => {
    const g = { ...DEFAULT, ...getSettings() };
    const a = (c.args[0] || '').toLowerCase();
    if (!a) {
      return c.reply(buildFrame('ANTI-BOT', [
        bullet('ÉTAT', g.antibot[c.from] === 'on' ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'),
        bullet('ACTION', g.antibotAction[c.from] || 'remove'),
        '',
        `Usage : ${config.prefix}antibot on|off`,
        `${config.prefix}antibot action/remove|warn|delete`,
      ]));
    }
    if (a === 'on' || a === 'off') {
      g.antibot[c.from] = a === 'on' ? 'on' : 'off';
      setSettings(g); saveState();
      return c.success(['ANTI-BOT', a === 'on' ? 'ACTIVÉ' : 'DÉSACTIVÉ']);
    }
    if (a === 'action') {
      const act = (c.args[1] || c.args[0]?.split('/')[1] || '').toLowerCase();
      if (!['remove', 'warn', 'delete'].includes(act)) {
        return c.error(['ACTION INCONNUE', `${config.prefix}ANTIBOT action/remove|warn|delete`]);
      }
      g.antibotAction[c.from] = act;
      setSettings(g); saveState();
      return c.success(['ACTION ANTI-BOT', act]);
    }
    return c.error(['USAGE', `${config.prefix}ANTIBOT on|off|action/...`]);
  });

  /* ── automute / autounmute ────────────────────────────────────── */
  cmd('automute', { cat: 2, desc: 'Ferme le groupe automatiquement à une heure', usage: 'automute HH:MM | automute del', group: true, admin: true, icon: '🔇' }, async (c) => {
    const g = { ...DEFAULT, ...getSettings() };
    const a = (c.args[0] || '').toLowerCase();
    if (!a) {
      const v = g.muteAt[c.from];
      return c.reply(buildFrame('FERMETURE AUTO', [
        bullet('HEURE', v || 'non réglée'),
        `${config.prefix}AUTOMUTE 21:30  ·  ${config.prefix}AUTOMUTE del`,
      ]));
    }
    if (a === 'del' || a === 'off') {
      delete g.muteAt[c.from];
      setSettings(g); saveState();
      return c.success(['FERMETURE AUTO ANNULÉE']);
    }
    const t = hhmm(a);
    if (!t) return c.error(['HEURE INVALIDE', `${config.prefix}AUTOMUTE 21:30`]);
    g.muteAt[c.from] = t;
    setSettings(g); saveState();
    startCron(c.sock, getSettings());
    return c.success(['FERMETURE AUTO', t]);
  });

  cmd('autounmute', { cat: 2, desc: 'Ouvre le groupe automatiquement à une heure', usage: 'autounmute HH:MM | autounmute del', group: true, admin: true, icon: '🔊' }, async (c) => {
    const g = { ...DEFAULT, ...getSettings() };
    const a = (c.args[0] || '').toLowerCase();
    if (!a) {
      const v = g.unmuteAt[c.from];
      return c.reply(buildFrame('OUVERTURE AUTO', [
        bullet('HEURE', v || 'non réglée'),
        `${config.prefix}AUTOUNMUTE 07:00  ·  ${config.prefix}AUTOUNMUTE del`,
      ]));
    }
    if (a === 'del' || a === 'off') {
      delete g.unmuteAt[c.from];
      setSettings(g); saveState();
      return c.success(['OUVERTURE AUTO ANNULÉE']);
    }
    const t = hhmm(a);
    if (!t) return c.error(['HEURE INVALIDE', `${config.prefix}AUTOUNMUTE 07:00`]);
    g.unmuteAt[c.from] = t;
    setSettings(g); saveState();
    startCron(c.sock, getSettings());
    return c.success(['OUVERTURE AUTO', t]);
  });

  /* ── groupcron : voir tout ── */
  cmd('groupcron', { cat: 2, desc: 'Voir les fermetures/ouvertures auto du groupe', usage: 'groupcron', group: true, icon: '⏰' }, async (c) => {
    const g = { ...DEFAULT, ...getSettings() };
    return c.reply(buildFrame('PROGRAMMATION', [
      bullet('ANTI-BOT', g.antibot[c.from] === 'on' ? `ACTIVÉ (${g.antibotAction[c.from] || 'remove'})` : 'désactivé'),
      bullet('FERMETURE AUTO', g.muteAt[c.from] || '—'),
      bullet('OUVERTURE AUTO', g.unmuteAt[c.from] || '—'),
    ]));
  });

  /* ── tagadmin ─────────────────────────────────────────────────── */
  cmd('tagadmin', { cat: 2, desc: 'Mentionner tous les admins du groupe', usage: 'tagadmin [message]', group: true, icon: '📣' }, async (c) => {
    let meta;
    try { meta = await c.sock.groupMetadata(c.from); } catch (e) { return c.error(['MÉTADONNÉES INDISPONIBLES', e.message]); }
    const admins = (meta.participants || []).filter((p) => p.admin);
    if (!admins.length) return c.error(['AUCUN ADMIN TROUVÉ']);
    const msg = (c.q || '').trim() || 'Appel aux admins';
    const mentions = admins.map((p) => p.id);
    const lines = admins.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`);
    await send(c.sock, c.from, {
      text: `${buildFrame('APPEL AUX ADMINS', [msg, '', ...lines, '', `Groupe : ${meta.subject || '—'}`])}`,
      mentions,
    }, { quoted: c.msg });
  });
}

/* ══════════════ cron interne (60 s, unref'd) ══════════════ */
function startCron(sock, getSettings) {
  if (cronTimer) return;
  let lastFired = ''; // évite de refirer dans la même minute
  cronTimer = setInterval(async () => {
    const hm = nowHM();
    if (hm === lastFired) return;
    const g = { ...DEFAULT, ...(getSettings ? getSettings() : {}) };
    for (const [jid, t] of Object.entries(g.muteAt || {})) {
      if (t === hm) {
        try { await sock.groupSettingUpdate(jid, 'announcement'); lastFired = hm; } catch {}
      }
    }
    for (const [jid, t] of Object.entries(g.unmuteAt || {})) {
      if (t === hm) {
        try { await sock.groupSettingUpdate(jid, 'not_announcement'); lastFired = hm; } catch {}
      }
    }
  }, 60000);
  cronTimer.unref?.();
}

function stopCron() { if (cronTimer) { clearInterval(cronTimer); cronTimer = null; } }

/* ══════════════ anti-bot : hook d'ajout de participant ══════════════
   Appelé par handler.handleGroupUpdate() sur un « add ».
   Heuristique prudente : un nom de compte qui ressemble à un bot
   (suffixe .bot / 🇧🇴🇹 / « bot » + 3 chiffres) déclenche l'action. */
const BOT_NAME_RE = /(^|\s)(bot|bOt|BOT|𝐁𝐨𝐭)[\s._-]*\d{0,6}$/i;
async function onParticipantAdd(sock, groupJid, participants, settings) {
  const g = { ...DEFAULT, ...(settings || {}) };
  if (g.antibot[groupJid] !== 'on') return;
  const action = g.antibotAction[groupJid] || 'remove';
  const suspects = (participants || []).filter((p) => {
    const id = String(p?.id || p || '');
    const user = id.split('@')[0];
    return BOT_NAME_RE.test(user) || user.startsWith('bot') || /bot\d{3,}$/i.test(user);
  });
  if (!suspects.length) return;
  for (const p of suspects) {
    const id = String(p?.id || p);
    try {
      if (action === 'remove') {
        await sock.groupParticipantsUpdate(groupJid, [id], 'remove');
      } else if (action === 'warn' && warnHook) {
        await warnHook(groupJid, id, 'bot détecté');
      }
      /* 'delete' = supprimer son message d'arrivée : pas de cible unique ici */
    } catch (e) { console.error('[ANTIBOT]', e.message); }
  }
  try {
    const { send } = require('./wa-send');
    await send(sock, groupJid, { text: `👾 Anti-bot : ${suspects.length} bot(s) détecté(s) → action « ${action} ».` });
  } catch {}
  return suspects.length;
}

function groupSettings(s) { return { ...DEFAULT, ...(s || {}) }; }

module.exports = {
  registerPortedGroup,
  startCron,
  stopCron,
  onParticipantAdd,
  groupSettings,
  DEFAULT,
};
