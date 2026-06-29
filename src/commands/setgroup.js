import { getDB } from '../lib/database.js';

export const name = 'setgroup';
export const aliases = ['setgroupe', 'gcontrol', 'groupcontrol'];
export const description = 'Active le contrôle admin sur ce groupe';
export const category = 'admin';
export const level = 'owner';

function getSetting(key) {
  try { return getDB().prepare('SELECT value FROM roblox_settings WHERE key=?').get(key)?.value ?? null; } catch { return null; }
}

function updateSetting(key, value) {
  try { getDB().prepare('INSERT OR REPLACE INTO roblox_settings (key,value) VALUES (?,?)').run(key, String(value)); } catch {}
}

export async function handler(sock, m, { isGroup, args, config }) {
  if (!args.length) {
    const current = getSetting('controlled_group');
    if (current) return m.reply(`🛡️ Groupe sous contrôle: *${current}*\n\nDésactiver: \`.setgroup off\``);
    return m.reply(`Usage:\n• \`.setgroup on\` — activer sur CE groupe\n• \`.setgroup off\` — désactiver`);
  }

  const value = args[0].toLowerCase();
  if (['off', 'none', '0'].includes(value)) {
    updateSetting('controlled_group', '');
    return m.reply('✅ Contrôle désactivé.');
  }

  if (['on', 'oui', 'yes'].includes(value)) {
    if (!isGroup) return m.reply('❌ Utilisez cette commande DANS le groupe à configurer.');

    try {
      const chat = m.key.remoteJid;
      const meta = await sock.groupMetadata(chat);
      const isAdmin = meta.participants?.some(
        p => p.id === sock.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
      );

      updateSetting('controlled_group', chat);
      let msg = `✅ *Groupe configuré!*\n\n📌 *${meta.subject}*`;
      msg += `\n🤖 Bot admin: ${isAdmin ? 'Oui ✅' : 'Non ❌'}`;
      m.reply(msg);
    } catch (e) {
      m.reply(`❌ Erreur: ${e.message}`);
    }
    return;
  }

  m.reply(`Usage:\n• \`.setgroup on\`\n• \`.setgroup off\``);
}
