const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const config = require('../config.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   GROUPE — Commandes de gestion de groupe adaptées de N-main
   Toutes les commandes vérifient les permissions admin automatiquement.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── INFO ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'groupinfo',
  alias: ['ginfo'],
  react: '📋',
  desc: 'Afficher les informations du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const admins = meta.participants.filter(p => p.admin);
    const creator = meta.owner ? '@' + meta.owner.split('@')[0] : 'Inconnu';
    const created = new Date(meta.creation * 1000).toLocaleDateString('fr-FR');
    const text = box('📋 *INFO GROUPE*', [
      { label: 'Nom', value: meta.subject },
      { label: 'ID', value: meta.id },
      { label: 'Membres', value: String(meta.participants.length) },
      { label: 'Admins', value: String(admins.length) },
      { label: 'Créateur', value: creator },
      { label: 'Créé le', value: created },
      { blank: true },
      { label: 'Description', value: (meta.desc || 'Aucune').slice(0, 200) },
    ]);
    await conn.sendMessage(m.chat, { text, mentions: meta.owner ? [meta.owner] : [] }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TAGALL ──────────────────────────────────────────────────────────────
cmd({
  pattern: 'tagall',
  react: '📢',
  desc: 'Mentionner tous les membres du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const mentions = meta.participants.map(p => p.id);
    const tagList = mentions.map(id => '@' + id.split('@')[0]).join('\n');
    const userText = q || '📢 *Appel général*';
    const admins = meta.participants.filter(p => p.admin).length;
    const text = box('📢 *TAGALL*', [
      { label: 'Groupe', value: meta.subject },
      { label: 'Auteur', value: '@' + m.sender.split('@')[0] },
      { label: 'Membres', value: String(meta.participants.length) },
      { label: 'Admins', value: String(admins) },
      { blank: true },
      { raw: '📝 *Message:* ' + userText },
      { blank: true },
      { raw: tagList },
    ]);
    await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── HIDETAG ─────────────────────────────────────────────────────────────
cmd({
  pattern: 'hidetag',
  react: '🔇',
  desc: 'Mentionner tous les membres silencieusement',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const mentions = meta.participants.map(p => p.id);
    const text = q || '🔇 *Message silencieux*';
    await conn.sendMessage(m.chat, { text: text + '\n\n_🔊 DJOUSSE TECH_', mentions }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── TAGADMIN ────────────────────────────────────────────────────────────
cmd({
  pattern: 'tagadmin',
  react: '👑',
  desc: 'Mentionner tous les admins',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  try {
    const meta = await conn.groupMetadata(m.chat);
    const admins = meta.participants.filter(p => p.admin);
    const mentions = admins.map(p => p.id);
    const tagList = mentions.map(id => '@' + id.split('@')[0]).join('\n');
    const text = box('👑 *ADMINS*', [
      { label: 'Groupe', value: meta.subject },
      { label: 'Nombre', value: String(admins.length) },
      { blank: true },
      { raw: tagList },
    ]);
    await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── KICK ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'kick',
  alias: ['remove'],
  react: '👢',
  desc: 'Retirer un membre du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  const meta = await conn.groupMetadata(m.chat);
  const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
  const botAdmin = meta.participants.find(p => p.id === botNumber)?.admin;
  if (!botAdmin) return reply('❌ Je ne suis pas admin.');
  const senderAdmin = meta.participants.find(p => p.id === m.sender)?.admin;
  if (!senderAdmin) return reply('❌ Tu n\'es pas admin.');

  const users = [];
  if (m.quoted) users.push(m.quoted.sender);
  if (q && q.replace(/[^0-9]/g, '')) users.push(q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

  if (!users.length) return reply('⚠️ Mentionne ou cite un utilisateur à retirer.');
  try {
    await conn.groupParticipantsUpdate(m.chat, users, 'remove');
    const names = users.map(u => '@' + u.split('@')[0]).join(', ');
    reply('✅ *Retiré:* ' + names);
  } catch (e) {
    reply('❌ Échec: ' + e.message);
  }
});

// ─── PROMOTE ─────────────────────────────────────────────────────────────
cmd({
  pattern: 'promote',
  alias: ['admin', 'toadmin'],
  react: '⬆️',
  desc: 'Promouvoir un membre admin',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  const meta = await conn.groupMetadata(m.chat);
  const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
  const botAdmin = meta.participants.find(p => p.id === botNumber)?.admin;
  if (!botAdmin) return reply('❌ Je ne suis pas admin.');
  const senderAdmin = meta.participants.find(p => p.id === m.sender)?.admin;
  if (!senderAdmin) return reply('❌ Tu n\'es pas admin.');

  const users = [];
  if (m.quoted) users.push(m.quoted.sender);
  if (q && q.replace(/[^0-9]/g, '')) users.push(q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

  if (!users.length) return reply('⚠️ Mentionne ou cite un utilisateur à promouvoir.');
  try {
    await conn.groupParticipantsUpdate(m.chat, users, 'promote');
    const names = users.map(u => '@' + u.split('@')[0]).join(', ');
    reply('✅ *Promu admin:* ' + names);
  } catch (e) {
    reply('❌ Échec: ' + e.message);
  }
});

// ─── DEMOTE ──────────────────────────────────────────────────────────────
cmd({
  pattern: 'demote',
  alias: ['unadmin', 'todown'],
  react: '⬇️',
  desc: 'Rétrograder un admin',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  const meta = await conn.groupMetadata(m.chat);
  const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
  const botAdmin = meta.participants.find(p => p.id === botNumber)?.admin;
  if (!botAdmin) return reply('❌ Je ne suis pas admin.');
  const senderAdmin = meta.participants.find(p => p.id === m.sender)?.admin;
  if (!senderAdmin) return reply('❌ Tu n\'es pas admin.');

  const users = [];
  if (m.quoted) users.push(m.quoted.sender);
  if (q && q.replace(/[^0-9]/g, '')) users.push(q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

  if (!users.length) return reply('⚠️ Mentionne ou cite un admin à rétrograder.');
  try {
    await conn.groupParticipantsUpdate(m.chat, users, 'demote');
    const names = users.map(u => '@' + u.split('@')[0]).join(', ');
    reply('✅ *Rétrogradé:* ' + names);
  } catch (e) {
    reply('❌ Échec: ' + e.message);
  }
});

// ─── LINK ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'link',
  alias: ['linkgc'],
  react: '🔗',
  desc: 'Obtenir le lien du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  if (!m.isGroup) return reply('🚫 Commande groupe uniquement.');
  const meta = await conn.groupMetadata(m.chat);
  const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
  const botAdmin = meta.participants.find(p => p.id === botNumber)?.admin;
  if (!botAdmin) return reply('❌ Je ne suis pas admin.');
  try {
    const code = await conn.groupInviteCode(m.chat);
    reply('🔗 *Lien du groupe:*\nhttps://chat.whatsapp.com/' + code);
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});

// ─── POLL ────────────────────────────────────────────────────────────────
cmd({
  pattern: 'poll',
  react: '📊',
  desc: 'Créer un sondage',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !q.includes('|')) {
    return reply('📊 *Utilisation:* .poll Question | Option1 | Option2 | Option3');
  }
  const [question, ...options] = q.split('|').map(t => t.trim());
  if (options.length < 2) return reply('⚠️ Au moins 2 options requises.');
  try {
    await conn.sendMessage(m.chat, { poll: { name: question, values: options } }, { quoted: m });
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
