const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

cmd({ pattern: 'pair', desc: 'Obtenir un code de paire WhatsApp', category: 'general', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const number = args[0];
  if (!number) return m.reply('❌ Usage: .pair <numéro>\nEx: .pair 237693978044');
  const clean = number.replace(/[^0-9]/g, '');
  if (clean.length < 10) return m.reply('❌ Numéro invalide.');
  try {
    const code = await conn.requestPairingCode(clean);
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
    m.reply(`🔑 *Code de paire*\n\n📱 Numéro: +${clean}\n🎫 Code: *${formatted}*\n\n> Ouvre WhatsApp > Appareils liés > Connecter > Entrer le code`);
  } catch (e) {
    m.reply('❌ Erreur: ' + (e.message || 'impossible de générer le code'));
  }
});

cmd({ pattern: 'bot_info', desc: 'Informations complètes du bot', category: 'owner', filename: __filename }, async (conn, m) => {
  const used = process.memoryUsage();
  const ram = (used.rss / 1024 / 1024).toFixed(2) + ' MB';
  const up = Math.floor(process.uptime());
  const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), mm = Math.floor((up % 3600) / 60), s = up % 60;
  const info = [
    '╭───『 *🤖 DJOUSSE TECH* 』───●●►',
    `┃ *👤 Nom:* ${config.BOT_NAME}`,
    `┃ *👑 Owner:* ${config.OWNER_NAME}`,
    `┃ *📱 Owner ID:* ${config.BOT_OWNER}`,
    `┃ *🔧 Préfixe:* "${config.PREFIX}"`,
    `┃ *🔄 Mode:* ${process.env.MODE || config.MODE}`,
    `┃ *⏱️ Uptime:* ${d}d ${h}h ${mm}m ${s}s`,
    `┃ *💾 RAM:* ${ram}`,
    `┃ *🖥️ Node:* ${process.version}`,
    `┃ *📡 Platform:* ${process.platform}`,
    `┃ *🔋 Nombre commandes:* ${(require('../command.cjs').commands || []).length}`,
    '╰─────────────❖●►',
  ].join('\n');
  await conn.sendMessage(m.chat, { text: info }, { quoted: m });
});

cmd({ pattern: 'deleteme', desc: 'Supprimer le message du bot que tu viens de demander', category: 'owner', filename: __filename }, async (conn, m) => {
  if (!m.quoted) return m.reply('❌ Réponds au message du bot à supprimer.');
  try {
    await conn.sendMessage(m.chat, { delete: m.quoted.key });
  } catch (e) {
    m.reply('❌ Impossible de supprimer ce message.');
  }
});
