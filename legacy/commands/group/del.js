const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;

const botJid = (conn) => (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';

cmd({ pattern: 'del', alias: ['delbot', 'clearbot'], desc: 'Supprimer TOUS les messages du bot dans le groupe (pour tout le monde)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
  const chat = m.chat;
  if (!chat?.endsWith('@g.us')) return m.reply(boxWithFooter('🗑️ *DEL*', [
    { raw: '❌ *Commande réservée aux groupes.*' },
  ]));

  const botNum = botJid(conn);
  /* 1) Les messages du bot trackés en mémoire (global.__recentBotMessages) */
  const recent = (global.__recentBotMessages && global.__recentBotMessages.get(chat)) || [];
  /* 2) L'historique récent du chat filtré sur fromMe/bot */
  let history = [];
  try {
    const msgs = await conn.loadMessages(chat, 250).catch(() => []);
    history = msgs.filter(x => x.key && (x.key.fromMe || String(x.key.participant || x.key.remoteJid).split(':')[0] + '@s.whatsapp.net' === botNum));
  } catch (e) {}

  // Fusionner et dédupliquer par id
  const seen = new Set();
  const keys = [];
  for (const k of [...recent, ...history.map(x => x.key)]) {
    if (!k || !k.id || seen.has(k.id)) continue;
    seen.add(k.id);
    keys.push(k);
  }

  /* 3) Ne pas supprimer le message de commande lui-même (il va être supprimé aussi) */
  let done = 0;
  const total = keys.length;
  for (const key of keys) {
    try { await conn.sendMessage(chat, { delete: key }); done++; } catch (e) {}
    if (done % 15 === 0) await new Promise(r => setTimeout(r, 400));
  }

  m.reply(boxWithFooter('🗑️ *DEL*', [
    { label: 'Supprimés', value: `${done} message(s)` },
    { label: 'Détectés', value: `${total}` },
    { raw: 'Messages du bot effacés pour tout le monde ✅' },
  ]));
});