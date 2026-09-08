import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('LEVEL');

const config = { xpPerMsg: 10, xpPerMedia: 25, xpPerVoice: 30, mult: 1.5, max: 100 };
const rewards = { 5: '🌟 Débutant', 10: '💫 Intermédiaire', 25: '⭐ Avancé', 50: '👑 Expert', 75: '🔥 Légende', 100: '🏆 Maître' };
const lastLevel = new Map();

export function xpForLevel(lv) { return Math.floor(100 * Math.pow(config.mult, lv - 1)); }

export function calcLevel(xp) {
  let lv = 1, total = 0;
  while (lv <= config.max) { total += xpForLevel(lv); if (xp < total) return lv; lv++; }
  return config.max;
}

export function getProgress(xp) {
  const lv = calcLevel(xp);
  let spent = 0;
  for (let i = 1; i < lv; i++) spent += xpForLevel(i);
  const into = xp - spent;
  const need = xpForLevel(lv);
  return { level: lv, current: into, needed: need, pct: Math.round((into / Math.max(1, need)) * 100) };
}

export function getReward(lv) { return rewards[lv] || null; }

let listener = null;
let enabled = false;

export function enableLeveling(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const sender = msg.key?.participant || msg.key?.remoteJid;
      if (!sender) continue;
      import('../../infrastructure/database/database.js').then(({ addXP, getUserLevel }) => {
        let xp = config.xpPerMsg;
        if (msg.message?.imageMessage || msg.message?.videoMessage) xp = config.xpPerMedia;
        else if (msg.message?.audioMessage) xp = config.xpPerVoice;
        addXP(sender, xp);
        const p = getProgress((getUserLevel(sender)?.xp || 0) + xp);
        const prev = lastLevel.get(sender) || 1;
        if (p.level > prev) {
          lastLevel.set(sender, p.level);
          const name = sock.contacts?.[sender]?.name || sock.contacts?.[sender]?.notify || sender.split('@')[0];
          const r = getReward(p.level);
          sock.sendMessage(msg.key.remoteJid, { text: `🎉 *LEVEL UP!*\n@${name} → Niveau ${p.level}${r ? `\n🏅 ${r}` : ''}`, mentions: [sender] });
        }
      }).catch(() => {});
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Leveling activé');
}

export function disableLeveling(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isLevelingOn() { return enabled; }
