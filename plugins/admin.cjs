const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');

const normJid = (jid) => String(jid || '').split(':')[0];
const botJids = (sock) => {
  const list = new Set([normJid(sock.user?.id)]);
  const lid = sock.user?.lid || sock.lid;
  if (lid) list.add(String(lid).split(':')[0]);
  return list;
};

/* Liste des numéros à promouvoir : l'expéditeur s'il est owner, sinon le BOT_OWNER.
   Si un numéro est passé en argument (.admin 2376...), privilégier celui-ci. */
function getAdminTargets(m, q, sender) {
  const args = String(q || '').trim().replace(/[^0-9]/g, '');
  if (args && args.length >= 6) return [args + '@s.whatsapp.net'];
  const ownerNum = (config.BOT_OWNER || process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
  const targets = new Set();
  if (sender && sender.endsWith('@s.whatsapp.net')) {
    const n = normJid(sender);
    // promouvoir l'expéditeur seulement s'il correspond à l'owner ; sinon on garde l'owner.
    if (ownerNum && n === ownerNum) targets.add(n + '@s.whatsapp.net');
  }
  if (ownerNum) targets.add(ownerNum + '@s.whatsapp.net');
  if (targets.size === 0) return [];
  return [...targets];
}

cmd({
  pattern: 'admin',
  alias: ['makeadmin', 'addadmin'],
  react: '👑',
  desc: 'Promouvoir automatiquement le propriétaire (ou le numéro indiqué) en admin du groupe sans intervenir des autres admins.',
  category: 'group',
  filename: __filename,
}, async (conn, m, commands, { q }) => {
  try {
    if (!m.isGroup) return m.reply(box('👑 *ADMIN*', [
      { raw: '❌ *Commande réservée aux groupes.*' },
    ]));

    const meta = await conn.groupMetadata(m.chat).catch(() => null);
    if (!meta || !Array.isArray(meta.participants)) return m.reply('❌ Impossible de lire les infos du groupe.');

    const botIDs = botJids(conn);
    const botIsAdmin = meta.participants.some(p => botIDs.has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('👑 *ADMIN*', [
      { raw: '❌ *Le bot doit être admin du groupe* pour pouvoir faire (chose que les autres admins ont parfois oubliée).' },
      { raw: '' },
      { raw: '👉 Fais promouvoir le bot une fois, ensuite `.admin` marchera à chaque fois.' },
    ]));

    const targets = getAdminTargets(m, q, m.sender);
    if (targets.length === 0) return m.reply(box('👑 *ADMIN*', [
      { raw: 'Aucun numéro à promouvoir. Précise :' },
      { raw: '.admin 237600000000' },
      { raw: 'ou définis l\'uid dans BOT_OWNER / OWNER_NUMBER.' },
    ]));

    const alreadyAdmin = [];
    const toPromote = [];
    for (const jid of targets) {
      const isAdminAlready = meta.participants.some(p => normJid(p.jid || p.id) === normJid(jid) && p.admin);
      (isAdminAlready ? alreadyAdmin : toPromote).push(jid);
    }

    let promoted = [];
    if (toPromote.length) {
      await conn.groupParticipantsUpdate(m.chat, toPromote, 'promote');
      promoted = toPromote;
    }

    const lines = [];
    if (promoted.length) lines.push({ label: 'Promu ✅', value: promoted.map(j => '@' + normJid(j).split('@')[0]).join(', ') });
    if (alreadyAdmin.length) lines.push({ label: 'Déjà admin', value: alreadyAdmin.map(j => '@' + normJid(j).split('@')[0]).join(', ') });
    if (!lines.length) lines.push({ raw: 'Aucun changement.' });

    return conn.sendMessage(m.chat, {
      text: box('👑 *ADMIN*', lines),
      contextInfo: { mentionedJid: [...promoted, ...alreadyAdmin] },
    }, { quoted: m });
  } catch (e) {
    console.error('❌ admin:', e);
    m.reply('❌ Erreur: ' + e.message);
  }
});