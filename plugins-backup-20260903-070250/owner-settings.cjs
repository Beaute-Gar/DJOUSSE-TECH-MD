const { cmd } = require('../command.cjs');
const rl = require('../lib/ratelimit.cjs');
const throttle = require('../lib/throttle.cjs');

cmd({ pattern: 'leave', desc: 'Quitter un groupe', category: 'owner', filename: __filename, fromMe: true }, async (conn, m) => {
  const target = m.body.split(' ')[1];
  const jid = (target && target.includes('@g.us') ? target : m.chat);
  if (!jid?.endsWith('@g.us')) return m.reply('❌ JID de groupe invalide.');
  await conn.sendMessage(jid, { text: '👋 Au revoir !' });
  await conn.groupLeave(jid);
  m.reply('✅ Groupe quitté.');
});

cmd({ pattern: 'bc', desc: 'Diffuser un message à tous les groupes/chats', category: 'owner', filename: __filename, fromMe: true }, async (conn, m) => {
  const bc = rl.hit('bc', 1, 60e3);
  if (bc.blocked) return m.reply("Diffusion deja lancee il y a moins d'une minute.");
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply('❌ Usage: .bc <message>');
  m.reply('📣 *Diffusion en cours...*');
  let sent = 0, failed = 0;
  try {
    const chats = conn.chats?.all ? conn.chats.all() : [];
    for (const c of chats) {
      if (!c.id) continue;
      try {
        const r = await throttle.throttledSend(conn, c.id, { text: `📢 *BROADCAST*\n\n${text}\n\n> © DJOUSSE TECH` });
        if (r.ok) sent++; else failed++;
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) { }
  m.reply(`✅ Diffusion terminée.\n📤 Envoyés: ${sent}\n❌ Échecs: ${failed}`);
});

cmd({ pattern: 'footer', desc: 'Changer le footer du bot', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const settings = require('../lib/settings.cjs');
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply(`❌ Usage: .footer <texte>\nActuel: ${settings.get('footer')}`);
  settings.set('footer', text);
  m.reply(`✅ Footer changé: "${text}"`);
});

cmd({ pattern: 'name', desc: 'Changer le nom du bot', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const settings = require('../lib/settings.cjs');
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply(`❌ Usage: .name <nom>\nActuel: ${settings.get('name')}`);
  settings.set('name', text);
  process.env.BOT_NAME = text;
  m.reply(`✅ Nom du bot changé: "${text}"`);
});

cmd({ pattern: 'setimage', desc: 'Changer l\'image du bot', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const settings = require('../lib/settings.cjs');
  const url = m.body.split(' ')[1];
  if (!url && !m.quoted) return m.reply('❌ Usage: .setimage <url> ou réponds à une image');
  if (url) {
    settings.set('image', url);
    m.reply('✅ Image changée.');
  } else {
    m.reply('❌ Envoie une URL d\'image.');
  }
});
