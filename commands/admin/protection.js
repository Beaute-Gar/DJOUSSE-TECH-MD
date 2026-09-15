const { cmd } = require('../command.cjs');
const protection = require('../lib/protection.cjs');
const botSettings = require('../lib/settings.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
const confirm = require('../lib/confirm.cjs');

const arg = m => (m.body || '').split(' ').slice(1).join(' ').trim().toLowerCase();
const botJid = conn => (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';

const bareNum = jid => (jid || '').split('@')[0].split(':')[0];
const botIds = (conn) => {
  const set = new Set();
  [conn.user?.id, conn.user?.lid, conn.lid].forEach(j => {
    const n = bareNum(j);
    if (n) set.add(n);
  });
  return set;
};

async function isBotAdmin(conn, chat) {
  try {
    const meta = await conn.groupMetadata(chat);
    const ids = botIds(conn);
    const p = (meta.participants || []).find(x => ids.has(bareNum(x.jid || x.id)));
    const ok = !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
    console.log('[ADMIN-CHECK]', chat, 'ids=' + [...ids].join(','), 'found=' + !!p, 'admin=' + (p && p.admin), '=>', ok ? 'ADMIN' : 'NOT-ADMIN');
    return ok;
  } catch (e) { console.log('[ADMIN-CHECK]', chat, 'ERR', e.message); return false; }
}

cmd({ pattern: 'autoapprove', desc: 'Approuver automatiquement les demandes de rejoindre', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  const v = arg(m);
  if (v !== 'on' && v !== 'off') return m.reply(`❌ Usage: .autoapprove on|off\nActuel: ${protection.get('autoapprove') ? '✅ ON' : '❌ OFF'}`);
  protection.set('autoapprove', v === 'on');
  m.reply(v === 'on' ? '✅ Auto-approve activé (demandes de groupe approuvées).' : '❌ Auto-approve désactivé.');
});

cmd({ pattern: 'autoreject', desc: 'Rejeter automatiquement les demandes/entrées', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  const v = arg(m);
  if (v !== 'on' && v !== 'off') return m.reply(`❌ Usage: .autoreject on|off\nActuel: ${protection.get('autoreject') ? '✅ ON' : '❌ OFF'}`);
  protection.set('autoreject', v === 'on');
  m.reply(v === 'on' ? '✅ Auto-reject activé (demandes rejetées, nouveaux entrants expulsés).' : '❌ Auto-reject désactivé.');
});

cmd({ pattern: 'online', desc: 'Garder le bot "en ligne" en permanence', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  const v = arg(m);
  if (v !== 'on' && v !== 'off') return m.reply(`❌ Usage: .online on|off`);
  if (v === 'on') {
    if (global.__djtOnlineTimer) return m.reply('✅ Déjà activé.');
    global.__djtOnlineTimer = setInterval(() => {
      try { conn.sendPresenceUpdate('available'); } catch (e) {}
    }, 8000);
    try { await conn.sendPresenceUpdate('available'); } catch (e) {}
    m.reply('✅ Le bot reste en ligne en permanence.');
  } else {
    if (global.__djtOnlineTimer) clearInterval(global.__djtOnlineTimer);
    global.__djtOnlineTimer = null;
    m.reply('❌ Présence en ligne désactivée.');
  }
});

cmd({ pattern: 'owneronly', desc: 'Réservé aux groupes : ne réagir QU\'AUX commandes de l\'owner (ignore les autres)', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  const v = arg(m);
  const cur = botSettings.get('owneronly');
  if (v !== 'on' && v !== 'off') return m.reply(`❌ Usage: .owneronly on|off\nActuel: ${cur ? '✅ ON' : '❌ OFF'}`);
  botSettings.set('owneronly', v === 'on');
  m.reply(v === 'on' ? `✅ Owner-only activé. Dans les groupes, le bot ignore les messages/commandes des membres (pas de confusion avec d'autres bots).\n📌 Les commandes des *autres bots* seront ignorées.` : '❌ Owner-only désactivé. Les membres peuvent à nouveau utiliser le bot.');
});

cmd({ pattern: 'delall', desc: 'Supprimer tous les messages du bot dans le groupe', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!m.chat?.endsWith('@g.us')) return m.reply('❌ Commandes de groupe uniquement.');
  if (!(await isBotAdmin(conn, m.chat))) return m.reply('❌ Le bot doit être admin.');
  return confirm.prompt(conn, m, `Supprimer tous les messages du bot dans ce groupe ?`, async (conn, m) => {
    m.reply('🗑️ Suppression des messages du bot en cours...');
    try {
      const j = String(m.chat).split(':')[0];
      const list = (global.__recentBotMessages && global.__recentBotMessages.get(j)) || [];
      let done = 0;
      for (const key of list) {
        try { await conn.sendMessage(m.chat, { delete: key }); done++; } catch (e) {}
        if (done % 20 === 0) await new Promise(r => setTimeout(r, 500));
      }
      if (global.__recentBotMessages) global.__recentBotMessages.set(j, []);
      m.reply(done ? `✅ ${done} message(s) du bot supprimé(s).` : '✅ Aucun message du bot en cache à supprimer.');
    } catch (e) { m.reply('❌ ' + e.message); }
  });
});

cmd({ pattern: 'setppgc', desc: 'Définir la photo du groupe (répondre à une image)', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!m.chat?.endsWith('@g.us')) return m.reply('❌ Commandes de groupe uniquement.');
  if (!m.quoted) return m.reply('❌ Réponds à une image avec .setppgc');
  try {
    const buf = await m.quoted.download();
    if (!buf) return m.reply('❌ Média introuvable.');
    await conn.updateProfilePicture(m.chat, buf);
    m.reply('✅ Photo de groupe mise à jour.');
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'removeppgc', desc: 'Supprimer la photo du groupe', category: 'protection', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!m.chat?.endsWith('@g.us')) return m.reply('❌ Commandes de groupe uniquement.');
  if (!(await isBotAdmin(conn, m.chat))) return m.reply('❌ Le bot doit être admin.');
  m.reply('⏳ Suppression de la photo du groupe...');
  try {
    await conn.removeProfilePicture(m.chat);
    m.reply('✅ Photo du groupe supprimée.');
  } catch (e) { m.reply('❌ ' + e.message); }
});

cmd({ pattern: 'take', desc: 'Changer le pack/author d\'un sticker (répondre au sticker)', category: 'convert', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!m.quoted) return m.reply('❌ Réponds à un sticker avec .take <pack>|<author>');
  const parts = (m.body || '').split(' ').slice(1).join(' ').split('|');
  const pack = (parts[0] || 'DJOUSSE TECH').trim();
  const author = (parts[1] || 'DJ').trim();
  try {
    const buf = await downloadMediaMessage(m.quoted, 'save');
    if (!buf) return m.reply('❌ Sticker introuvable.');
    const { WebP } = require('node-webpmux');
    const img = new WebP();
    await img.load(buf);
    const exifData = JSON.stringify({
      'sticker-pack-id': 'djt-' + Date.now(),
      'sticker-pack-name': pack,
      'sticker-author-name': author,
      'sticker-pack-publisher': 'DJOUSSE TECH',
    });
    img.exif = Buffer.concat([
      Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
      Buffer.from(exifData),
    ]);
    const out = await img.save(null);
    await conn.sendMessage(m.chat, { sticker: out }, { quoted: m });
    m.reply(`✅ Sticker recréé\n📦 Pack: ${pack}\n✍️ Auteur: ${author}`);
  } catch (e) { m.reply('❌ ' + e.message); }
});
