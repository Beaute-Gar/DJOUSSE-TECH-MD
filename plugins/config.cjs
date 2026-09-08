const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'config', desc: 'Afficher la configuration actuelle', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const c = require('../config-djousse.cjs');
m.reply(box('⚙️ *CONFIGURATION*', [
  { label: 'Bot', value: `*${c.BOT_NAME}*` },
  { label: 'Owner', value: `*${c.OWNER_NAME}*` },
  { label: 'Owner ID', value: `*${c.BOT_OWNER}*` },
  { label: 'Préfixe', value: `*${c.PREFIX}*` },
  { label: 'Mode', value: `*${c.MODE}*` },
  { label: 'Auto Status Seen', value: `*${c.AUTO_STATUS_SEEN}*` },
  { label: 'Auto Status React', value: `*${c.AUTO_STATUS_REACT}*` },
  { label: 'Anti Delete', value: `*${c.ANTI_DELETE}*` },
]));
});