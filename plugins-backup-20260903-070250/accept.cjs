const { cmd } = require('../command.cjs');
const groupAccess = require('../lib/group-access.cjs');

cmd({ pattern: 'accept', desc: 'Autoriser les membres du groupe à utiliser le bot (owner)', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, { q, reply }) => {
  if (!m.isGroup) return reply('❌ Utilisable uniquement dans un groupe.');
  const sub = String(q || '').trim().toLowerCase();

  if (sub === 'off' || sub === 'non' || sub === 'remove') {
    groupAccess.revoke(m.chat);
    return reply('🔴 *Accès membres révoqué*\n\nSeuls les administrateurs du groupe peuvent maintenant utiliser le bot.');
  }

  if (sub === 'status' || sub === 'info') {
    const s = groupAccess.status(m.chat);
    return reply(s.accepted
      ? '🟢 *Accès membres : ACTIF*\n\nTous les membres peuvent utiliser les commandes du bot.\nPour révoquer : .accept off'
      : '🔴 *Accès membres : INACTIF*\n\nSeuls les administrateurs du groupe et l\'owner peuvent utiliser le bot.\nPour autoriser : .accept');
  }

  groupAccess.accept(m.chat);
  return reply('🟢 *ACCÈS AUTORISÉ*\n\n✅ Tous les membres du groupe peuvent maintenant utiliser les commandes du bot.\nPour révoquer : .accept off');
});
