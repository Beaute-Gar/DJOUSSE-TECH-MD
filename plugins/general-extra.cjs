const { cmd } = require('../command.cjs');
const { fetchJson, getBuffer } = require('../lib/functions.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'getdp', desc: 'Photo de profil d\'un utilisateur', category: 'general', filename: __filename }, async (conn, m, commands, config) => {
  const target = (m.quoted && m.quoted.sender) || (m.mention && m.mention[0]) || m.sender;
  try {
    const ppUrl = await conn.profilePictureUrl(target, 'image');
    const caption = box('🖼️ *PHOTO DE PROFIL*', [
      { label: '👤 Utilisateur', value: `@${target.split('@')[0]}` },
    ]);
    await conn.sendMessage(m.chat, { image: { url: ppUrl }, caption, mentions: [target] }, { quoted: m });
  } catch {
    m.reply('❌ Cet utilisateur n\'a pas de photo de profil ou est introuvable.');
  }
});

cmd({ pattern: 'chr', desc: 'Compter les caractères d\'un texte', category: 'general', filename: __filename }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply(box('📊 *COMPTEUR*', [
    { label: 'Utilisation', value: '.chr <texte>' },
  ]));
  m.reply(box('📊 *COMPTEUR DE CARACTÈRES*', [
    { label: 'Caractères', value: `*${text.length}*` },
    { label: 'Sans espaces', value: `*${text.replace(/\s/g, '').length}*` },
    { label: 'Mots', value: `*${text.trim().split(/\s+/).length}*` },
  ]));
});

cmd({ pattern: 'readmore', desc: 'Créer un texte avec "Read More"', category: 'general', filename: __filename }, async (conn, m) => {
  const args = m.body.split(' ').slice(1).join(' ').split('|');
  if (args.length < 2) return m.reply(box('👋🏻 *READ MORE*', [
    { label: 'Utilisation', value: '.readmore partie1|partie2' },
  ]));
  const hidden = '👋🏻\uFE0F\u200D'.repeat(500);
  m.reply(args[0] + hidden + args[1]);
});

cmd({ pattern: 'forward', desc: 'Transférer un message cité à un numéro/groupe', category: 'general', filename: __filename, fromMe: true }, async (conn, m) => {
  const target = m.body.split(' ')[1];
  if (!m.quoted || !m.quoted.key) return m.reply(box('📤 *FORWARD*', [
    { label: 'Utilisation', value: '.forward <jid ou numéro>' },
    { label: 'Astuce', value: 'Réponds au message à transférer' },
  ]));
  if (!target) return m.reply(box('📤 *FORWARD*', [
    { label: 'Utilisation', value: '.forward <jid>' },
    { label: 'Exemple', value: '.forward 237693978044@s.whatsapp.net' },
  ]));
  const jid = target.includes('@') ? target : target + '@s.whatsapp.net';
  try {
    await conn.sendMessage(jid, { forward: m.quoted.key, contextInfo: { forwardingScore: 999 } });
    m.reply(box('📤 *FORWARD*', [
      { label: 'Statut', value: '✅ Transféré' },
      { label: 'Vers', value: jid },
    ]));
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'send', desc: 'Envoyer un texte à un numéro/groupe', category: 'general', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const target = args[0];
  const text = args.slice(1).join(' ');
  if (!target || !text) return m.reply(box('📨 *ENVOI*', [
    { label: 'Utilisation', value: '.send <jid> <texte>' },
    { label: 'Exemple', value: '.send 237693978044 Bonjour' },
  ]));
  const jid = target.includes('@') ? target : target + '@s.whatsapp.net';
  try {
    await conn.sendMessage(jid, { text });
    m.reply(box('📨 *ENVOI*', [
      { label: 'Statut', value: '✅ Envoyé' },
      { label: 'Vers', value: jid },
    ]));
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'statuspost', desc: 'Publier un média cité sur ton statut avec les recommandations anti-ban', category: 'general', filename: __filename, fromMe: true }, async (conn, m) => {
  if (!m.quoted || !m.quoted.msg) {
    return m.reply(box('📤 *POST STATUT*', [
      { label: 'Utilisation', value: '.statuspost' },
      { label: 'Astuce', value: 'Réponds à une image/vidéo à publier' },
      { label: 'Note', value: 'La note RECOMMANDATIONS est ajoutée automatiquement' },
    ]));
  }
  const mediaType = m.quoted.type === 'viewOnceMessage' ? m.quoted.msg?.type : m.quoted.type;
  if (mediaType !== 'imageMessage' && mediaType !== 'videoMessage') {
    return m.reply('❌ Seules les images et vidéos peuvent être publiées en statut.');
  }
  const note = box('💡 *RECOMMANDATIONS*', [
    { label: 'Pour éviter les bannissements WhatsApp :', value: '' },
    { label: '✅ autoview: true', value: 'Laissez activé (regarde les statuts)' },
    { label: '✅ autolike: true', value: 'Laissez activé (like les statuts)' },
    { label: '⚠️ autoreact: true', value: 'Soyez prudent (peut être considéré comme spam)' },
    { label: '❌ alwaysonline: false', value: 'Gardez désactivé (suspect)' },
    { label: '❌ autorecording: false', value: 'Gardez désactivé' },
    { label: 'Pour une meilleure sécurité :', value: '' },
    { label: '✅ antiedit: true', value: 'Gardez activé' },
    { label: '✅ anticall: false', value: 'Gardez désactivé' },
    { label: '✅ owneronly: true', value: 'Gardez activé' },
    { label: '⚠️ antilinkaction: delete', value: 'Parfait pour les groupes' },
  ]);
  const custom = m.body.split(' ').slice(1).join(' ').trim();
  const caption = custom ? custom + '\n\n' + note : note;
  try {
    const buffer = await m.quoted.download('status-post');
    if (!buffer) return m.reply('❌ Impossible de télécharger le média cité.');
    if (mediaType === 'videoMessage') {
      await conn.sendMessage('status@broadcast', { video: buffer, caption, mimetype: 'video/mp4' });
    } else {
      await conn.sendMessage('status@broadcast', { image: buffer, caption });
    }
    m.reply(box('📤 *POST STATUT*', [
      { label: 'Statut', value: '✅ Publié' },
      { label: 'Media', value: mediaType === 'videoMessage' ? '🎬 Vidéo' : '🖼️ Image' },
      { label: 'Note', value: '💡 Recommandations ajoutées' },
    ]));
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({ pattern: 'autostatus', desc: 'Voir les statuts automatiquement (on/off)', category: 'general', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ')[1]?.toLowerCase();
  const current = config.AUTO_STATUS_SEEN;
  if (args === 'on' || args === 'off') {
    config.AUTO_STATUS_SEEN = args === 'on';
    m.reply(box('👁️ *AUTO-STATUT*', [
      { label: 'Statut', value: args === 'on' ? '✅ ON' : '⚫ OFF' },
    ]));
  } else {
    m.reply(box('👁️ *AUTO-STATUT*', [
      { label: 'Actuel', value: current ? '✅ ON' : '⚫ OFF' },
      { label: 'Utilisation', value: '.autostatus on|off' },
    ]));
  }
});
