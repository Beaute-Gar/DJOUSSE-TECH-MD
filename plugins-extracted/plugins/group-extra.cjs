const { cmd } = require('../command.cjs');
const settings = require('../lib/settings.cjs');

const isGroup = m => m.chat?.endsWith('@g.us');

cmd({ pattern: 'groupstatus', desc: 'Voir l\'état du groupe', category: 'group', filename: __filename }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const admins = (meta.participants || []).filter(p => p.admin);
    const txt = [
      '👥 *INFO GROUPE*',
      '',
      `📛 *Nom:* ${meta.subject}`,
      `👑 *Propriétaire:* @${(meta.owner || '').split('@')[0] || '?'}`,
      `👥 *Participants:* ${(meta.participants || []).length}`,
      `🛡️ *Admins:* ${admins.length}`,
      `📝 *Description:* ${(meta.desc || 'Aucune').slice(0, 200)}`,
      `🆔 *ID:* ${m.chat}`,
    ].join('\n');
    await conn.sendMessage(m.chat, { text: txt, mentions: admins.map(a => a.id) }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'gcstatus', alias: ['togstatus'], desc: 'Publier un statut de groupe (texte/image/video/audio)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commandes de groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const sender = (m.sender || '').split('@')[0] + '@s.whatsapp.net';
    const isAdmin = (meta.participants || []).some(p => p.id === sender && p.admin);
    if (!isAdmin) return m.reply('❌ Tu dois être admin pour utiliser cette commande.');
    const teks = (m.text || m.quoted?.text || '').trim();
    let media = null;
    let type = null;
    if (m.quoted) {
      const mt = m.quoted.msg?.['imageMessage'] || m.quoted.msg?.['videoMessage'] || m.quoted.msg?.['audioMessage'];
      if (mt) type = mt.imageMessage ? 'image' : mt.videoMessage ? 'video' : 'audio';
      else if (m.quoted.type === 'imageMessage') type = 'image';
      else if (m.quoted.type === 'videoMessage') type = 'video';
      else if (m.quoted.type === 'audioMessage') type = 'audio';
      if (type) {
        try { media = await m.quoted.download(); } catch (e) { media = null; }
      }
    }
    if (!media && !teks) {
      return m.reply(`❗ *Usage:*\n${m.prefix}gcstatus <texte>\nOu réponds à une image/vidéo/audio avec ${m.prefix}gcstatus <légende optionnelle>\n\n*Exemple:* ${m.prefix}gcstatus Salut tout le monde !`);
    }
    const peserta = (meta.participants || []).map(v => v.id);
    const ctx = { mentionedJid: peserta, isGroupStatus: true };
    try {
      if (!media) {
        await conn.sendMessage(m.chat, { text: teks || 'undefined', contextInfo: ctx }, { backgroundColor: '#000000', statusJidList: peserta });
      } else if (type === 'image') {
        await conn.sendMessage(m.chat, { image: media, caption: teks || '', contextInfo: ctx }, { statusJidList: peserta });
      } else if (type === 'video') {
        await conn.sendMessage(m.chat, { video: media, caption: teks || '', contextInfo: ctx }, { statusJidList: peserta });
      } else if (type === 'audio') {
        await conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mp4', ptt: false, contextInfo: ctx }, { statusJidList: peserta });
      }
      return m.reply('✅ Statut publié dans le groupe.');
    } catch (e) {
      return m.reply('❌ Erreur publication: ' + e.message);
    }
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'kickall2', desc: 'Expulser tous les membres (sauf admins et bot)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const botJid = conn.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const adminIds = new Set((meta.participants || []).filter(p => p.admin).map(p => p.id));
    adminIds.add(botJid);
    const targets = (meta.participants || []).map(p => p.id).filter(id => !adminIds.has(id));
    if (!targets.length) return m.reply('⚠️ Aucun membre à expulser.');
    m.reply(`⏳ Expulsion de *${targets.length}* membres...`);
    await conn.groupParticipantsUpdate(m.chat, targets, 'remove');
    m.reply(`✅ ${targets.length} membres expulsés.`);
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'warnlist', desc: 'Voir la liste des warns', category: 'group', filename: __filename }, async (conn, m) => {
  const fs = require('fs');
  let warns = {};
  try { warns = JSON.parse(fs.readFileSync('./database/warns.json', 'utf8')); } catch { }
  const entries = Object.entries(warns).filter(([k, v]) => Array.isArray(v) && v.length);
  if (!entries.length) return m.reply('✅ Aucun warn enregistré.');
  let txt = '⚠️ *LISTE DES WARNS*\n\n';
  entries.forEach(([jid, list]) => {
    txt += `👤 @${jid.split('@')[0]} → *${list.length}/3*\n`;
    txt += list.map((w, i) => `   ${i + 1}. ${w.reason} (${w.date?.slice(0, 10)})`).join('\n');
    txt += '\n\n';
  });
  await conn.sendMessage(m.chat, { text: txt, mentions: entries.map(([j]) => j) }, { quoted: m });
});

cmd({ pattern: 'resetwarn', desc: 'Réinitialiser les warns', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const fs = require('fs');
  const target = m.quoted?.sender || (m.mention && m.mention[0]) || m.body.split(' ')[1]?.replace('@', '');
  if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.');
  const jid = target.includes('@') ? target : target + '@s.whatsapp.net';
  try {
    const warns = JSON.parse(fs.readFileSync('./database/warns.json', 'utf8'));
    warns[jid] = [];
    fs.writeFileSync('./database/warns.json', JSON.stringify(warns, null, 2));
    m.reply(`✅ Warns réinitialisés pour @${jid.split('@')[0]}.`);
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'hidetag', desc: 'Message avec mention de tous (caché)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  const text = m.body.split(' ').slice(1).join(' ') || ' ';
  try {
    const meta = await conn.groupMetadata(m.chat);
    const mentions = (meta.participants || []).map(p => p.id);
    await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'gcinfo', desc: 'Informations détaillées du groupe', category: 'group', filename: __filename }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const desc = meta.desc || 'Aucune description';
    const txt = [
      '📋 *GC INFO*',
      '',
      `📛 *Nom:* ${meta.subject}`,
      `🆔 *ID:* ${m.chat}`,
      `👑 *Owner:* @${(meta.owner || '').split('@')[0]}`,
      `👥 *Total:* ${(meta.participants || []).length}`,
      `📝 *Description:*\n${desc.slice(0, 500)}`,
      `⏰ *Créé:* ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : '?'}`,
    ].join('\n');
    const ppUrl = await conn.profilePictureUrl(m.chat, 'image').catch(() => null);
    if (ppUrl) {
      await conn.sendMessage(m.chat, { image: { url: ppUrl }, caption: txt }, { quoted: m });
    } else {
      m.reply(txt);
    }
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'gclink', desc: 'Obtenir le lien d\'invitation du groupe', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  try {
    const code = await conn.groupInviteCode(m.chat);
    m.reply(`🔗 *Lien d\'invitation:*\nhttps://chat.whatsapp.com/${code}`);
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'pin', desc: 'Épingler un message dans le groupe', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!isGroup(m)) return m.reply('❌ Commande de groupe uniquement.');
  if (!m.quoted?.key) return m.reply('❌ Réponds au message à épingler.');
  const args = m.body.split(' ')[1]?.toLowerCase();
  const unpin = args === 'unpin';
  try {
    await conn.sendMessage(m.chat, { pin: { type: unpin ? 'unpin_message' : 'pin_message', key: m.quoted.key } });
    m.reply(unpin ? '📌 Message désépinglé.' : '📌 Message épinglé.');
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

/* Anti settings — réglages persistants */
cmd({ pattern: 'antilinkaction', desc: 'Action anti-lien (delete/kick/warn)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const action = m.body.split(' ')[1]?.toLowerCase();
  if (!['delete', 'kick', 'warn', 'off'].includes(action)) {
    return m.reply(`❌ Usage: .antilinkaction delete|kick|warn|off\nActuel: ${settings.get('antilinkaction')}`);
  }
  settings.set('antilinkaction', action);
  m.reply(`✅ Action anti-lien: ${action}`);
});

cmd({ pattern: 'antibot', desc: 'Activer/désactiver anti-bot', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('antibot');
  m.reply(`🤖 Anti-bot: ${state ? 'ON' : 'OFF'}`);
});

cmd({ pattern: 'antibad', desc: 'Activer/désactiver anti-mots interdits', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('antibad');
  m.reply(`🚫 Anti-mots interdits: ${state ? 'ON' : 'OFF'}`);
});

cmd({ pattern: 'anticall', desc: 'Activer/désactiver anti-appel', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('anticall');
  m.reply(`📞 Anti-appel: ${state ? 'ON' : 'OFF'}`);
});

cmd({ pattern: 'antimention', desc: 'Activer/désactiver anti-mention de tous', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('antimention');
  m.reply(`📢 Anti-mention: ${state ? 'ON' : 'OFF'}`);
});

cmd({ pattern: 'antiedit', desc: 'Activer/désactiver anti-édition de message', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('antiedit');
  m.reply(`✏️ Anti-édition: ${state ? 'ON' : 'OFF'}`);
});

cmd({ pattern: 'goodbye', desc: 'Activer/désactiver le message de départ', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const state = settings.toggle('goodbye');
  m.reply(`👋 Message de départ: ${state ? 'ON' : 'OFF'}`);
});
