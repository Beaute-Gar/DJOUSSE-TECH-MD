import {
  setRobloxGroup, setRobloxEnabled,
  startAutoPoster, stopAutoPoster,
  autoPost, getStats, clearSilence,
} from '../modules/roblox-elite.js';

export const name = 'roblox';
export const aliases = ['rb', 'rlx'];
export const description = 'Contrôle le module animateur Roblox Elite';
export const category = 'admin';
export const level = 'sudo';

const USAGE = (prefix) =>
`╔══『 *🎮 ROBLOX ELITE* 』══╗

*${prefix}roblox on*   — Activer le module
*${prefix}roblox off*  — Désactiver le module
*${prefix}roblox set*  — Définir ce groupe comme cible
*${prefix}roblox post* — Forcer une publication maintenant
*${prefix}roblox stats*— Afficher les statistiques
*${prefix}roblox reset*— Réinitialiser le silence

╚══『 *Djousse Tech Evolution* 』══╝`;

export async function handler(sock, m, { args, prefix }) {
  const sub = (args[0] || '').toLowerCase();
  const chat = m.key.remoteJid;

  switch (sub) {
    case 'on': {
      setRobloxEnabled(true);
      startAutoPoster(sock, chat);
      await m.reply('✅ Module Roblox Elite *activé* — le bot anime ce groupe automatiquement.');
      break;
    }
    case 'off': {
      setRobloxEnabled(false);
      stopAutoPoster();
      await m.reply('⏹️ Module Roblox Elite *désactivé*.');
      break;
    }
    case 'set': {
      setRobloxGroup(chat);
      await m.reply(`📌 Groupe cible défini :\n\`${chat}\`\n\nLance *${prefix}roblox on* pour démarrer.`);
      break;
    }
    case 'post': {
      await m.reply('📤 Publication forcée en cours...');
      await autoPost(sock, chat);
      break;
    }
    case 'stats': {
      const s = getStats();
      const reply =
`📊 *ROBLOX ELITE — Stats*

🟢 Activé      : ${s.enabled ? 'Oui' : 'Non'}
📍 Groupe      : ${s.group}
⏳ Silence     : ${s.silenceRemaining}s restantes
📤 En cours    : ${s.isPosting ? 'Oui' : 'Non'}
📋 File post   : ${s.queueLength} tâche(s)
💬 Activité    : ${s.activityCount} msg/min
🎮 Publiés     : ${s.sessionPosted} jeux (session)
🎯 Dernier type: ${s.lastContentType}
⏰ Scheduler   : ${s.schedulerActive ? 'Actif' : 'Inactif'}`;
      await m.reply(reply);
      break;
    }
    case 'reset': {
      clearSilence();
      await m.reply('🔄 Silence réinitialisé — le bot peut de nouveau répondre.');
      break;
    }
    default:
      await m.reply(USAGE(prefix));
  }
}
