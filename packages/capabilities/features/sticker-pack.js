import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';
import { createLogger } from '../../infrastructure/logger.js';
import { executor, ACTION_TYPES } from '../../ainoria-intelligence/actions/action-executor.js';

const log = createLogger('STICKERPACK');

const TABLE = 'user_sticker_packs';

async function ensureTable() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT NOT NULL,
      sticker_buffer BLOB NOT NULL,
      pack_name TEXT DEFAULT 'personal',
      emoji TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      UNIQUE(jid, sticker_buffer)
    )
  `);
}

export async function saveSticker(jid, stickerBuf, packName = 'personal', emoji = '') {
  await ensureTable();
  try {
    await rawRun(
      `INSERT OR IGNORE INTO ${TABLE} (jid, sticker_buffer, pack_name, emoji, created_at) VALUES (?, ?, ?, ?, ?)`,
      [jid, stickerBuf, packName, emoji, Date.now()]
    );
    return true;
  } catch (e) {
    log.warn(`Save sticker: ${e.message}`);
    return false;
  }
}

export async function getPackStickers(jid, packName = 'personal', limit = 50) {
  await ensureTable();
  try {
    return await rawAll(
      `SELECT sticker_buffer, emoji FROM ${TABLE} WHERE jid = ? AND pack_name = ? ORDER BY created_at DESC LIMIT ?`,
      [jid, packName, limit]
    );
  } catch (e) {
    log.warn(`Get pack: ${e.message}`);
    return [];
  }
}

export async function getRandomSticker(jid, packName = 'personal') {
  const stickers = await getPackStickers(jid, packName, 100);
  if (!stickers.length) return null;
  const random = stickers[Math.floor(Math.random() * stickers.length)];
  return random.sticker_buffer;
}

export async function listPacks(jid) {
  await ensureTable();
  try {
    return await rawAll(
      `SELECT pack_name, COUNT(*) as count FROM ${TABLE} WHERE jid = ? GROUP BY pack_name`,
      [jid]
    );
  } catch (e) {
    log.warn(`List packs: ${e.message}`);
    return [];
  }
}

export async function deleteSticker(jid, stickerBuf) {
  await ensureTable();
  try {
    await rawRun(`DELETE FROM ${TABLE} WHERE jid = ? AND sticker_buffer = ?`, [jid, stickerBuf]);
    return true;
  } catch (e) {
    log.warn(`Delete sticker: ${e.message}`);
    return false;
  }
}

export async function sendRandomSticker(sock, jid, senderJid, packName = 'personal') {
  const sticker = await getRandomSticker(senderJid, packName);
  if (!sticker) {
    return { success: false, reason: 'Aucun sticker dans ce pack' };
  }
  
  try {
    await sock.sendMessage(jid, { sticker, quoted: { key: { remoteJid: jid, fromMe: false, id: 'sticker' } } });
    return { success: true };
  } catch (e) {
    log.warn(`Send random sticker: ${e.message}`);
    return { success: false, reason: e.message };
  }
}

export const stickerpackName = 'stickerpack';
export const stickerpackAliases = ['sp', 'mypack', 'stickpack'];
export const stickerpackDescription = 'Gérer vos packs de stickers personnels';
export const stickerpackCategory = 'media';
export const stickerpackLevel = 'user';

export async function stickerpackHandler(sock, m, { args, text, prefix, reply }) {
  const sender = m.sender;
  const subCmd = args[0]?.toLowerCase();
  
  if (!subCmd) {
    const packs = await listPacks(sender);
    let msg = `📦 *Vos packs de stickers*\n\n`;
    if (!packs.length) {
      msg += `Aucun pack. Envoyez des stickers avec .take ou .sticker pour les sauvegarder !`;
    } else {
      packs.forEach(p => {
        msg += `  • ${p.pack_name} — ${p.count} stickers\n`;
      });
      msg += `\nCommandes:\n`;
      msg += `  ${prefix}stickerpack random [pack] — Sticker aléatoire\n`;
      msg += `  ${prefix}stickerpack list [pack] — Lister stickers\n`;
      msg += `  ${prefix}stickerpack delete [pack] — Supprimer pack`;
    }
    return reply(msg);
  }
  
  if (subCmd === 'random' || subCmd === 'r') {
    const pack = args[1] || 'personal';
    const result = await sendRandomSticker(sock, m.key.remoteJid, sender, pack);
    if (!result.success) {
      return reply(`❌ ${result.reason}`);
    }
    return;
  }
  
  if (subCmd === 'list' || subCmd === 'l') {
    const pack = args[1] || 'personal';
    const stickers = await getPackStickers(sender, pack, 20);
    if (!stickers.length) {
      return reply(`📦 Pack "${pack}" vide ou inexistant`);
    }
    return reply(`📦 *Pack "${pack}" — ${stickers.length} stickers*\nUtilisez \`${prefix}stickerpack random ${pack}\` pour en envoyer un.`);
  }
  
  if (subCmd === 'delete' || subCmd === 'del') {
    const pack = args[1];
    if (!pack) return reply(`❌ Usage: ${prefix}stickerpack delete <pack>`);
    return reply(`⚠️ Suppression non implémentée encore`);
  }
  
  return reply(`❌ Sous-commande inconnue. Disponibles: random, list, delete`);
}

export const takeStickerName = 'takesticker';
export const takeStickerAliases = ['takestk', 'savesticker', 'keep'];
export const takeStickerDescription = 'Sauvegarder un sticker reçu dans votre pack personnel';
export const takeStickerCategory = 'media';
export const takeStickerLevel = 'user';

export async function takeStickerHandler(sock, m, { isQuoted, quotedMsg, reply }) {
  if (!isQuoted) {
    return reply('❌ Répondez à un sticker pour le sauvegarder');
  }
  
  const stickerMsg = quotedMsg?.stickerMessage;
  if (!stickerMsg) {
    return reply('❌ Ce n\'est pas un sticker');
  }
  
  try {
    await reply('💾 Sauvegarde du sticker...');
    
    const buffer = await m.download(true);
    if (!buffer?.length) {
      return reply('❌ Impossible de télécharger');
    }
    
    const saved = await saveSticker(m.sender, buffer, 'personal', '');
    if (saved) {
      await reply('✅ Sticker sauvegardé dans votre pack "personal" !\nUtilisez `.stickerpack random` pour l\'envoyer.');
    } else {
      await reply('⚠️ Déjà dans votre pack ou erreur');
    }
  } catch (e) {
    log.warn(`Save sticker error: ${e.message}`);
    await reply(`❌ Erreur: ${e.message}`);
  }
}