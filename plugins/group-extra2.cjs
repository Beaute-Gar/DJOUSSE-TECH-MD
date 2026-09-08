const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'debate',
  alias: ['debat'],
  desc: 'Lancer un débat IA dans le groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q }) => {
  const chat = m.chat;
  if (!String(chat).endsWith('@g.us')) return m.reply('🔒 Cette commande est réservée aux groupes.');
  if (!q) {
    return m.reply(box('🧠 *DÉBAT IA*', [
      { raw: 'Lance un débat sur un sujet donné.' },
      { blank: true },
      { raw: 'Utilisation: .debate <sujet>' },
      { raw: 'Exemple: .debate L\'IA va-t-elle remplacer les humains ?' },
    ]));
  }
  try {
    const { chat: aiChat } = require('../lib/ai.cjs');
    const prompt = `Tu es un modérateur de débat. Pose 3 arguments POUR et 3 arguments CONTRE ce sujet, puis conclus de manière équilibrée. Sujet: ${q}`;
    const response = await aiChat(prompt, { system: 'Tu es un expert en débat. Réponds en français, de manière structurée et équilibrée.' });
    await m.reply('🧠 *DÉBAT:* ' + q + '\n\n' + response);
  } catch (e) {
    m.reply('❌ Erreur débat: ' + e.message);
  }
});

cmd({
  pattern: 'groupinfo',
  alias: ['gcinfo', 'inforesume'],
  desc: 'Résumé des infos du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m) => {
  const chat = m.chat;
  if (!String(chat).endsWith('@g.us')) return m.reply('🔒 Cette commande est réservée aux groupes.');
  try {
    const meta = await conn.groupMetadata(chat);
    const name = meta.subject || 'Inconnu';
    const desc = meta.description || 'Aucune description';
    const owner = meta.owner ? meta.owner.split('@')[0] : 'Inconnu';
    const members = meta.participants ? meta.participants.length : 0;
    const admins = meta.participants ? meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length : 0;
    const locked = meta.restrict ? '🔒 Oui' : '🔓 Non';
    const text = box('👥 *INFOS GROUPE*', [
      { label: '📛 Nom', value: `*${name}*` },
      { label: '👤 Owner', value: `*${owner}*` },
      { label: '👥 Membres', value: `*${members}*` },
      { label: '🛡️ Admins', value: `*${admins}*` },
      { label: '🔐 Verrouillé', value: locked },
      { blank: true },
      { raw: '📝 *Description:*' },
      { raw: desc.slice(0, 300) },
    ]);
    await m.reply(text);
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});

cmd({
  pattern: 'stopgroup',
  alias: ['stopgrp', 'arreter'],
  desc: 'Arrêter les automatisations du groupe',
  category: 'group',
  filename: __filename,
}, async (conn, m) => {
  const chat = m.chat;
  if (!String(chat).endsWith('@g.us')) return m.reply('🔒 Cette commande est réservée aux groupes.');
  try {
    const settingsPath = require('path').join(__dirname, '..', 'database', 'group-settings.json');
    let settings = {};
    try { settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf8')); } catch {}
    if (!settings[chat]) settings[chat] = {};
    settings[chat].autoDebate = false;
    settings[chat].autoActivity = false;
    require('fs').writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    m.reply('🛑 *Automatisations arrêtées*\n\nLes fonctionnalités automatiques du groupe ont été désactivées.');
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
});
