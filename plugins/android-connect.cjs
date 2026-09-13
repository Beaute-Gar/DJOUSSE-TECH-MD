const { cmd } = require('../command.cjs');

/* ══════════════════════════════════════════════════════════════════════════════
   android-connect.cjs — Gestion de la connexion Android
   
   .androidconnect  → Affiche le statut de connexion Android
   .androidpairing  → Génère un code de pairing pour l'APK
   .androidreset    → Reset la connexion Android
   ══════════════════════════════════════════════════════════════════════════════ */

const BOT_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || ('https://' + (process.env.RENDER_SERVICE_NAME || 'bot') + '.onrender.com');

cmd({
  pattern: 'androidconnect',
  alias: ['aconnect', 'android'],
  category: 'owner',
  fromMe: true,
  desc: 'Statut connexion Android',
  filename: __filename
}, async (conn, m, commands, { reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');

  const status = global.androidConnect || { status: 'disconnected' };
  const sockOk = conn && conn.user;
  const botNumber = sockOk ? String(conn.user.id).split(':')[0].split('@')[0] : null;

  let text = '📱 *CONNEXION ANDROID*\n\n';
  text += '┌─────────────────────────────┐\n';

  if (status.status === 'connected') {
    const uptime = status.connectedAt ? Math.floor((Date.now() - status.connectedAt) / 60000) : 0;
    text += '│ ✅ *Statut : CONNECTÉ*\n';
    text += '│ 📲 Méthode : ' + (status.method === 'session_export' ? 'Session Export (Root)' : 'Pairing Code') + '\n';
    text += '│ 📞 Numéro : +' + (status.number || '?') + '\n';
    text += '│ ⏱️ Depuis : ' + uptime + ' min\n';
    text += '│ 🔄 Dernier ping : ' + (status.lastPing ? new Date(status.lastPing).toLocaleTimeString('fr-FR') : '?') + '\n';
  } else if (status.status === 'pairing') {
    text += '│ ⏳ *Statut : EN ATTENTE DE PAIRING*\n';
    text += '│ 📞 Numéro : +' + (status.number || '?') + '\n';
    text += '│ 💡 Entre le code dans WhatsApp > Appareils liés\n';
  } else {
    text += '│ ❌ *Statut : DÉCONNECTÉ*\n';
    text += '│ 💡 Utilise .androidpairing pour démarrer\n';
  }

  text += '├─────────────────────────────┤\n';
  text += '│ 🤖 Bot : ' + (botNumber ? '+' + botNumber : 'Hors ligne') + '\n';
  text += '│ ⚙️ Moteur : ' + (global.currentEngine || '?') + '\n';
  text += '└─────────────────────────────┘\n\n';

  text += '📲 *Comment connecter l\'APK :*\n';
  text += '1. Installe l\'APK DJOUSSE CONNECT\n';
  text += '2. Tape *.androidpairing* ici\n';
  text += '3. Entre le code dans l\'APK\n';
  text += '4. Ouvre WhatsApp > Appareils liés\n';
  text += '5. Entre le code affiché\n\n';

  text += '🔗 *API Endpoints :*\n';
  text += '• GET ' + BOT_URL + '/api/android-status\n';
  text += '• GET ' + BOT_URL + '/api/android-pairing?number=...\n';
  text += '• POST ' + BOT_URL + '/api/android-session\n';
  text += '• POST ' + BOT_URL + '/api/android-ping';

  reply(text);
});

cmd({
  pattern: 'androidpairing',
  alias: ['apair'],
  category: 'owner',
  fromMe: true,
  desc: 'Générer un code de pairing Android',
  filename: __filename
}, async (conn, m, commands, { reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');

  const number = String(m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!number || number.length < 7) {
    return reply('❌ Impossible de détecter ton numéro. Utilise :\n.androidpairing <numéro>');
  }

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const res = await fetch(BOT_URL + '/api/android-pairing?number=' + number);
    const data = await res.json();

    if (data.success && data.code) {
      const formatted = data.code;
      reply(
        '📱 *CODE PAIRING ANDROID*\n\n' +
        '🔢 Code : *' + formatted + '*\n' +
        '⏰ Expire dans : ' + Math.floor(data.expiresIn / 60000) + ' min\n\n' +
        '📲 *Instructions :*\n' +
        '1. Ouvre l\'APK DJOUSSE CONNECT\n' +
        '2. Entre ce code\n' +
        '3. Ouvre WhatsApp > Appareils liés\n' +
        '4. Entre le même code\n\n' +
        '⚡ Le bot se connectera automatiquement !'
      );
    } else {
      reply('❌ Erreur: ' + (data.error || 'Impossible de générer le code'));
    }
  } catch (e) {
    reply('❌ Erreur de connexion au serveur: ' + e.message);
  }
});

cmd({
  pattern: 'androidreset',
  alias: ['areset'],
  category: 'owner',
  fromMe: true,
  desc: 'Reset la connexion Android',
  filename: __filename
}, async (conn, m, commands, { reply, isOwner }) => {
  if (!isOwner) return reply('❌ Commande réservée au propriétaire.');

  global.androidConnect = {
    status: 'disconnected',
    method: null,
    number: null,
    connectedAt: null,
    lastPing: null
  };

  reply('✅ Connexion Android resetée.\n\nPour te reconnecter, utilise *.androidpairing*');
});
