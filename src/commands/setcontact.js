import { getDB } from '../lib/database.js';

export const name = 'setcontact';
export const aliases = ['setreply', 'autoreply', 'contact'];
export const description = 'Définit un contact pour l\'auto-réponse';
export const category = 'admin';
export const level = 'owner';

function getSetting(key) {
  try { return getDB().prepare('SELECT value FROM roblox_settings WHERE key=?').get(key)?.value ?? null; } catch { return null; }
}

function updateSetting(key, value) {
  try { getDB().prepare('INSERT OR REPLACE INTO roblox_settings (key,value) VALUES (?,?)').run(key, String(value)); } catch {}
}

export async function handler(sock, m, { args }) {
  if (!args.length) {
    const current = getSetting('auto_reply_contact');
    if (current) return m.reply(`📞 Contact auto-réponse actuel: *${current}*\n\nPour le désactiver: \`.setcontact off\``);
    return m.reply(`Usage: \`.setcontact <numéro>\`\nExemple: \`.setcontact 237659809751\``);
  }

  const value = args[0].toLowerCase();
  if (['off', 'none', '0'].includes(value)) {
    updateSetting('auto_reply_contact', '');
    return m.reply('✅ Auto-réponse désactivée.');
  }

  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length < 5) return m.reply('❌ Numéro invalide.');

  updateSetting('auto_reply_contact', cleaned);
  m.reply(`✅ Auto-réponse définie pour: *${cleaned}*`);
}
