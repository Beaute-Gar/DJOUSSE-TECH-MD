const { cmd } = require('../command.cjs');
const fs = require('fs');
const settings = require('../lib/settings.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const cfgPath = './config-djousse.cjs';
cmd({ pattern: 'mode', desc: 'Changer le mode du bot (public/private)', category: 'admin', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const newMode = args[0]?.toLowerCase();
if (!['public','private','invisible'].includes(newMode)) return conn.sendMessage(m.chat, { text: box('🔧 *MODE BOT*', [
  { label: 'Mode actuel', value: `*${process.env.MODE || 'public'}*` },
  { blank: true },
  { raw: '*Modes disponibles :*' },
  { raw: '• public — Tout le monde' },
  { raw: '• private — Admin only' },
  { raw: '• invisible — En ligne sans réponses' },
  { blank: true },
  { raw: 'Ex : .mode public' },
]) }, { quoted: m });
process.env.MODE = newMode;
settings.set('mode', newMode);
conn.sendMessage(m.chat, { text: box('🔧 *MODE BOT*', [
  { label: 'Mode actuel', value: `*${newMode}*` },
  { label: 'Statut', value: '✅ Mis à jour' },
]) }, { quoted: m });
});