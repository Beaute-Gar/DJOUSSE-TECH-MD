const { cmd } = require('../command.cjs');
const settings = require('../lib/settings.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const config = require('../config-djousse.cjs');

const AUTOS = ['autoai', 'autoview', 'autoreact', 'autoread', 'autorecording', 'autotyping', 'autovoice', 'autobio', 'alwaysonline', 'alwaysoffline', 'readcmdonly'];

const SETTINGS_META = {
  autoai: ['🤖', 'Auto-AI'],
  autoview: ['👁️', 'Auto-View'],
  autolike: ['👍', 'Auto-Like'],
  autoreact: ['🎭', 'Auto-React'],
  autoread: ['✅', 'Auto-Read'],
  autorecording: ['🎙️', 'Auto-Recording'],
  autotyping: ['⌨️', 'Auto-Typing'],
  autovoice: ['🎧', 'Auto-Voice'],
  autobio: ['🖋️', 'Auto-Bio'],
  alwaysonline: ['🟢', 'Always Online'],
  alwaysoffline: ['⚫', 'Always Offline'],
  readcmdonly: ['🔧', 'Read Cmd Only'],
};

function toggleReply(m, key) {
  const [emoji, label] = SETTINGS_META[key];
  const state = settings.toggle(key);
  m.reply(box(`${emoji} *${label.toUpperCase()}*`, [
    { label: 'Statut', value: state ? '✅ ON' : '⚫ OFF' },
  ]));
}

/* .autolike contrôle le vrai flag de réaction aux statuts (AUTO_STATUS_REACT),
   pas seulement une clé orpheline dans settings.json. */
cmd({ pattern: 'autolike', desc: 'Like automatique des statuts (on/off)', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ')[1]?.toLowerCase();
  const current = !!config.AUTO_STATUS_REACT;
  if (args === 'on' || args === 'off') {
    config.AUTO_STATUS_REACT = args === 'on';
    settings.set('autolike', args === 'on');
    m.reply(box('👍 *AUTO-LIKE*', [
      { label: 'Statut', value: args === 'on' ? '✅ ON' : '⚫ OFF' },
    ]));
  } else {
    m.reply(box('👍 *AUTO-LIKE*', [
      { label: 'Actuel', value: current ? '✅ ON' : '⚫ OFF' },
      { label: 'Utilisation', value: '.autolike on|off' },
    ]));
  }
});

for (const key of AUTOS) {
  cmd({ pattern: key, desc: `Paramètre ${key}`, category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
    toggleReply(m, key);
  });
}

cmd({ pattern: 'autoreplytext', desc: 'Texte de réponse automatique personnalisé', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const text = m.body.split(' ').slice(1).join(' ');
  if (!text) return m.reply(box('💬 *TEXTE AUTO-RÉPONSE*', [
    { label: 'Utilisation', value: '.autoreplytext <texte>' },
    { label: 'Actuel', value: settings.get('autoreplytext') || '(vide)' },
  ]));
  settings.set('autoreplytext', text);
  m.reply(box('💬 *TEXTE AUTO-RÉPONSE*', [
    { label: 'Texte', value: `*"${text}"*` },
  ]));
});
