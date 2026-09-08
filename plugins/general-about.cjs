const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');
const fs = require('fs');
const path = require('path');

cmd({
  pattern: 'about',
  alias: ['apropos', 'info'],
  desc: 'À propos du bot',
  category: 'general',
  filename: __filename,
}, async (conn, m) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const min = Math.floor((uptime % 3600) / 60);
  const text = box('ℹ️ *À PROPOS — DJOUSSE TECH*', [
    { label: '🤖 Bot', value: '*DJOUSSE-TECH-MD*' },
    { label: '👨‍💻 Développeur', value: '*Beaute Gar / Djousse Tech Evolution*' },
    { label: '🌍 Origine', value: '*Cameroun*' },
    { label: '📦 Version', value: '*2.1*' },
    { label: '⏱️ Uptime', value: `*${h}h ${min}m*` },
    { label: '🧠 Moteurs IA', value: '*GROQ, Gemini, OpenRouter*' },
    { label: '📡 Moteur WhatsApp', value: `*${(process.env.ENGINE_TYPE || 'baileys').toUpperCase()}*` },
    { blank: true },
    { raw: '💡 Bot WhatsApp intelligent avec IA intégrée.' },
    { raw: 'Créé avec passion au Cameroun 🇨🇲' },
  ]);
  await m.reply(text);
});

cmd({
  pattern: 'oublie',
  alias: ['forget', 'reset', 'clear'],
  desc: 'Effacer la mémoire de la conversation',
  category: 'general',
  filename: __filename,
}, async (conn, m) => {
  const chat = m.chat;
  if (global.__chatMemory && global.__chatMemory.has(chat)) {
    global.__chatMemory.delete(chat);
    return m.reply('🧠 *Mémoire effacée*\n\nLa conversation a été réinitialisée.');
  }
  m.reply('🧠 Aucune mémoire à effacer pour cette conversation.');
});

cmd({
  pattern: 'profil',
  alias: ['profile', 'myprofile'],
  desc: 'Voir ton profil utilisateur',
  category: 'general',
  filename: __filename,
}, async (conn, m) => {
  const user = m.sender;
  const num = user.split('@')[0];
  const name = m.pushName || 'Inconnu';
  let ppUrl = '';
  try {
    ppUrl = await conn.profilePictureUrl(user, 'image');
  } catch {}
  const text = box('👤 *TON PROFIL*', [
    { label: '📛 Nom', value: `*${name}*` },
    { label: '📱 Numéro', value: `*${num}*` },
    { label: '🆔 JID', value: `\`${user}\`` },
  ]);
  if (ppUrl) {
    await conn.sendMessage(m.chat, { image: { url: ppUrl }, caption: text }, { quoted: m });
  } else {
    await m.reply(text);
  }
});
