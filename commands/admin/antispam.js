const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const settings = require('../lib/settings.cjs');

cmd({
  pattern: 'antispam',
  react: '🛡️',
  desc: 'Anti-spam protection (warn/kick/off)',
  category: 'admin',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
  const mode = (q || '').split(' ')[0].toLowerCase();

  if (!mode || !['warn', 'kick', 'off'].includes(mode)) {
    const current = settings.get('antispam') || 'off';
    return reply(box('🛡️ *ANTI-SPAM*', [
      { label: 'Mode actuel', value: current.toUpperCase() },
      { blank: true },
      { raw: 'Modes disponibles :' },
      { raw: '.antispam warn — Avertir (3 warns = kick)' },
      { raw: '.antispam kick — Expulser directement' },
      { raw: '.antispam off — Désactiver' },
    ]));
  }

  settings.set('antispam', mode);
  reply('🛡️ Anti-spam mode: *' + mode.toUpperCase() + '*');
});
