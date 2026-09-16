const { cmd } = require('../command.cjs');
const fs = require('fs');
const settings = require('../lib/settings.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'mode',
  react: '🔧',
  desc: 'Changer le mode du bot (public/private/invisible)',
  category: 'admin',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
  const config = require('../config.cjs');
  const botNumber = await conn.decodeJid(conn.user.id);
  const isCreator = [botNumber, config.OWNER_NUMBER + '@s.whatsapp.net', ...(config.SUDO || [])].includes(m.sender);

  if (!isCreator) {
    return reply('⛔ *ACCÈS REFUSÉ*\n\n📖 Cette commande est réservée au *Propriétaire* ou aux *Sudo*.');
  }

  const newMode = (q || '').split(' ')[0].toLowerCase();

  if (!newMode || !['public', 'private', 'invisible'].includes(newMode)) {
    const current = process.env.MODE || settings.get('mode') || 'public';
    return reply(box('🔧 *MODE BOT*', [
      { label: 'Mode actuel', value: '*' + current + '*' },
      { blank: true },
      { raw: '*Modes disponibles :*' },
      { raw: '• public — Tout le monde' },
      { raw: '• private — Admin only' },
      { raw: '• invisible — En ligne sans réponses' },
      { blank: true },
      { raw: 'Ex : .mode public' },
    ]));
  }

  process.env.MODE = newMode;
  settings.set('mode', newMode);

  if (newMode === 'invisible') {
    await conn.sendMessage(m.chat, { text: '👻 Mode *INVISIBLE* activé. Le bot est en ligne mais ne répond plus.' }, { quoted: m });
  } else {
    reply(box('🔧 *MODE BOT*', [
      { label: 'Mode', value: '*' + newMode + '*' },
      { label: 'Statut', value: '✅ Mis à jour' },
    ]));
  }
});
