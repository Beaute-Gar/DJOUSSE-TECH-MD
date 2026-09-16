const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');

function loadReminders() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveReminders(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function parseDuration(str) {
  const m = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  const val = parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const pendingReminders = new Map();

cmd({
  pattern: 'reminder',
  alias: ['remind', 'rappel', 'alarm'],
  desc: 'Programmer un rappel',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply, sender }) => {
  if (!q) {
    const reminders = loadReminders().filter(r => r.chat === m.chat);
    const lines = reminders.length
      ? reminders.map((r, i) => `${i + 1}. ${r.message.slice(0, 50)} — dans ${formatTime(r.triggerAt - Date.now())}`).join('\n')
      : 'Aucun rappel actif dans ce groupe.';
    return reply(box('⏰ *RAPPELS*', [
      { label: 'Usage', value: '.reminder <durée> <message>' },
      { label: 'Durées', value: '30s, 5m, 2h, 1d' },
      { label: 'Exemple', value: '.reminder 2h Réunion' },
      { blank: true },
      { raw: lines },
    ]));
  }

  const parts = q.trim().split(/\s+/);
  const duration = parseDuration(parts[0]);
  if (!duration || duration > 7 * 86400000) {
    return reply('❌ Durée invalide. Utilise: `30s`, `5m`, `2h`, `1d` (max 7 jours)');
  }

  const message = parts.slice(1).join(' ').trim() || 'Rappel !';
  const triggerAt = Date.now() + duration;
  const reminder = {
    id: Date.now().toString(36),
    chat: m.chat,
    sender: sender || m.sender,
    message,
    triggerAt,
    created: Date.now()
  };

  const reminders = loadReminders();
  reminders.push(reminder);
  saveReminders(reminders);

  await m.react('⏰');
  return reply(box('⏰ *RAPPEL ENREGISTRÉ*', [
    { label: 'Message', value: message.slice(0, 80) },
    { label: 'Dans', value: formatTime(duration) },
    { label: 'À', value: new Date(triggerAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
  ]));
});

cmd({
  pattern: 'remindlist',
  alias: ['reminders', 'rappels'],
  desc: 'Voir tous les rappels',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const reminders = loadReminders().filter(r => r.chat === m.chat && r.triggerAt > Date.now());
  if (!reminders.length) return reply('⏰ Aucun rappel actif.');

  const lines = reminders.map((r, i) => {
    const remain = r.triggerAt - Date.now();
    return `${i + 1}. ${r.message.slice(0, 40)} — dans ${formatTime(remain)}`;
  }).join('\n');

  return reply(box('⏰ *RAPPELS ACTIFS*', [{ raw: lines }]));
});

cmd({
  pattern: 'remindcancel',
  alias: ['rcancel', 'rappelcancel'],
  desc: 'Annuler un rappel',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply('❌ Usage: .remindcancel <numéro>');

  const idx = parseInt(q) - 1;
  const reminders = loadReminders();
  const chatReminders = reminders.filter(r => r.chat === m.chat && r.triggerAt > Date.now());

  if (idx < 0 || idx >= chatReminders.length) return reply('❌ Numéro invalide');

  const target = chatReminders[idx];
  const newReminders = reminders.filter(r => r.id !== target.id);
  saveReminders(newReminders);

  return reply('✅ Rappel annulé: ' + target.message.slice(0, 50));
});

setInterval(() => {
  const now = Date.now();
  const reminders = loadReminders();
  const due = reminders.filter(r => r.triggerAt <= now);
  if (!due.length) return;

  const remaining = reminders.filter(r => r.triggerAt > now);
  saveReminders(remaining);

  for (const r of due) {
    try {
      const conn = globalThis.__conn;
      if (conn) {
        conn.sendMessage(r.chat, {
          text: box('⏰ *RAPPEL*', [
            { raw: r.message },
            { blank: true },
            { label: 'Pour', value: '@' + (r.sender || '').replace(/@.*$/, '') },
          ]),
          mentions: r.sender ? [r.sender] : []
        });
      }
    } catch {}
  }
}, 5000);
