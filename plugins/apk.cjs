const { cmd } = require('../command.cjs');
const path = require('path');
const fs = require('fs');

/* ══════════════════════════════════════════════════════════════════════════════
   apk.cjs — Commande APK DJOUSSE CONNECT
   
   .apk                → Affiche les instructions de connexion Android
   .apk install        → Envoie le lien de téléchargement APK
   .apk status         → Vérifie la connexion Android
   ══════════════════════════════════════════════════════════════════════════════ */

const BOT_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || ('https://' + (process.env.RENDER_SERVICE_NAME || 'djousse-tech-md') + '.onrender.com');

// Chercher l'APK dans le dossier media ou public
const APK_PATHS = [
  path.join(__dirname, '..', 'media', 'djousse-connect.apk'),
  path.join(__dirname, '..', 'public', 'djousse-connect.apk'),
  path.join(__dirname, '..', 'djousse-connect.apk'),
];

function findApk() {
  for (const p of APK_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

cmd({
  pattern: 'apk',
  alias: ['android', 'install', 'download'],
  category: 'tools',
  desc: 'Télécharger l\'APK DJOUSSE CONNECT pour Android',
  filename: __filename
}, async (conn, m, commands, { q, reply }) => {
  const sub = (q || '').toLowerCase().trim();

  // .apk status
  if (sub === 'status') {
    const status = global.androidConnect || { status: 'disconnected' };
    const sockOk = global.sock && global.sock.user;
    let text = '📱 *STATUT ANDROID*\n\n';
    text += '• Bot : ' + (sockOk ? '🟢 En ligne' : '🔴 Hors ligne') + '\n';
    text += '• Android : ' + (status.status === 'connected' ? '🟢 Connecté' : status.status === 'pairing' ? '🟡 En attente' : '🔴 Déconnecté') + '\n';
    if (status.number) text += '• Numéro : +' + status.number + '\n';
    if (status.method) text += '• Méthode : ' + (status.method === 'session_export' ? 'Root' : 'Pairing Code') + '\n';
    return reply(text);
  }

  // .apk install — envoyer l'APK si disponible
  const apkPath = findApk();
  if (apkPath) {
    try {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(apkPath),
        fileName: 'DJOUSSE-CONNECT.apk',
        mimetype: 'application/vnd.android.package-archive',
        caption: '📱 *DJOUSSE CONNECT APK*\n\n📲 Installe l\'APK et suis les instructions pour connecter ton WhatsApp sans QR code.'
      }, { quoted: m });
      return;
    } catch (e) {
      return reply('❌ Erreur envoi APK: ' + e.message);
    }
  }

  // .apk — Instructions par défaut
  const name = m.pushName || 'ami';
  reply(
    '📱 *DJOUSSE CONNECT — Connexion Android*\n\n' +
    'Salut ' + name + ' ! 👋\n\n' +
    'L\'APK *DJOUSSE CONNECT* te permet de connecter le bot à ton WhatsApp *sans scanner de QR code*.\n\n' +
    '┌─────────────────────────────────┐\n' +
    '│ 📲 *COMMENT CA MARCHE ?*\n' +
    '├─────────────────────────────────┤\n' +
    '│\n' +
    '│ *Option 1 : Avec Code* ✅\n' +
    '│ 1. Tape .androidpairing\n' +
    '│ 2. Ouvre WhatsApp > Appareils liés\n' +
    '│ 3. Entre le code affiché\n' +
    '│ 4. C\'est bon !\n' +
    '│\n' +
    '│ *Option 2 : Auto (Root)* 🚀\n' +
    '│ 1. Installe l\'APK\n' +
    '│ 2. Autorise les permissions root\n' +
    '│ 3. L\'APK lit ta session WhatsApp\n' +
    '│ 4. Le bot se connecte tout seul !n' +
    '│\n' +
    '└─────────────────────────────────┘\n\n' +
    '📲 *APK Download :*\n' +
    '• Tape *.apk install* pour recevoir l\'APK\n' +
    '• Ou télécharge depuis : ' + BOT_URL + '/djousse-connect.apk\n\n' +
    '🔗 *Liens utiles :*\n' +
    '• .androidpairing → Générer un code\n' +
    '• .androidconnect → Voir le statut\n' +
    '• .apk status → Statut rapide'
  );
});
