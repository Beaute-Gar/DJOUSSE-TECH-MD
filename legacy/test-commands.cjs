/**
 * test-commands.cjs
 * Teste toutes les commandes et envoie le rapport .txt sur WhatsApp
 * Reprise automatique après déconnexion (reprend là où il s'est arrêté)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ⚙️ CONFIGURATION
const BOT_NUMBER = '237659809751';
const TEST_NUMBER = '237693978044';
const DELAY_BETWEEN = 35000; // 35s (anti-ban = 30s)
const RESPONSE_TIMEOUT = 45000; // 45s (30s anti-ban + 15s réponse)
const SESSION_DIR = path.join(__dirname, 'test-session');
const STATE_FILE = path.join(__dirname, 'test-state.json');

// 📋 COMMANDES À TESTER
const COMMANDS = [
  '.allmenu', '.hansuptime', '.host', '.info', '.menu', '.owner', '.repo', '.verify',
  '.create', '.join', '.personality', '.prefix', '.security',
  '.ainoria', '.clonevoice', '.clonevoicesave', '.myvoice', '.voicedel', '.voiceinfo',
  '.mem', '.memoire', '.oublier',
  '.label',
  '.autoreply',
  '.toimage', '.tts bonjour',
  '.fb https://www.facebook.com/watch?v=123', '.ig https://www.instagram.com/reel/test', '.lyrics despacito', '.pinterest https://pin.it/test', '.song despacito', '.tt https://vm.tiktok.com/test', '.twitter https://x.com/test', '.ytmp4 despacito',
  '.autolevelup', '.balance', '.buy', '.crime', '.daily', '.dep', '.economy',
  '.levelup', '.mine', '.pay 100 @user', '.role', '.shop', '.topcoins', '.wd', '.weekly', '.work',
  '.8ball Will it rain?', '.babyname', '.bestie', '.caption test', '.character', '.coinflip', '.dare',
  '.debate', '.divorce', '.enemy', '.fact', '.fortune', '.goodmorning', '.goodnight',
  '.guessnumber', '.hangman', '.horoscope', '.hug', '.joke', '.kiss', '.love', '.marry',
  '.memes', '.mood', '.nhie', '.poke', '.profession', '.quote', '.resetgame', '.roast',
  '.roulette', '.rps', '.slap', '.slots', '.soulmate', '.story', '.ttt', '.vs', '.wanted', '.wyr',
  '.base64 123', '.convert', '.toaudio', '.toimg',
  '.hansfast', '.ppcouple',
  '.antivv', '.bot_info', '.deleteme', '.securitestats', '.statusreply',
  '.myaccount', '.stats',
  '.movie inception', '.linkinfo',
  '.pdf', '.tourl', '.vv',
  '.code', '.jid',
];

// 📊 RÉSULTATS
let results = [];
let currentCmdIndex = 0;
let sock = null;

// ✅ Sauvegarder l'état
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ currentCmdIndex, results }, null, 2));
}

// ✅ Charger l'état
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      currentCmdIndex = state.currentCmdIndex || 0;
      results = state.results || [];
      console.log(`📂 État chargé: ${currentCmdIndex}/${COMMANDS.length} déjà testés`);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// ✅ Attendre une réponse du bot
let pendingResolve = null;
let pendingTimer = null;

function waitForBotResponse() {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    pendingTimer = setTimeout(() => {
      pendingResolve = null;
      resolve(null);
    }, RESPONSE_TIMEOUT);
  });
}

// ✅ Capture UNIQUEMENT les messages du bot
function setupMessageHandler() {
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue; // Ignorer nos propres messages

      const from = msg.key.remoteJid.split('@')[0];

      // ✅ On ne capture QUE les messages du bot
      if (from !== BOT_NUMBER) continue;

      const text = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || '';

      if (text && pendingResolve) {
        clearTimeout(pendingTimer);
        const resolve = pendingResolve;
        pendingResolve = null;
        pendingTimer = null;
        resolve(text);
      }
    }
  });
}

async function sendNextCommand() {
  if (currentCmdIndex >= COMMANDS.length) {
    console.log('\n✅ TOUS LES TESTS TERMINÉS');
    await generateAndSendReport();
    process.exit(0);
    return;
  }

  const cmd = COMMANDS[currentCmdIndex];
  const botJid = `${BOT_NUMBER}@s.whatsapp.net`;

  console.log(`\n[${currentCmdIndex + 1}/${COMMANDS.length}] 📤 Envoi: ${cmd}`);
  console.log(`   ⏳ Attente 35s (anti-ban)...`);

  // ✅ Marquer comme en cours AVANT d'envoyer (pour la reprise)
  saveState();

  try {
    await sock.sendMessage(botJid, { text: cmd });

    const response = await waitForBotResponse();

    if (response) {
      let status = '✅ OK';

      if (response.includes('Erreur') || response.includes('erreur') || response.includes('Error')) {
        status = '❌ ERREUR';
      }
      if (response.includes('[object Object]')) {
        status = '⚠️ BUG (object)';
      }
      if (response.includes('undefined') && !response.includes('undefined function')) {
        status = '⚠️ BUG (undefined)';
      }
      if (response.includes('not defined') || response.includes('is not iterable')) {
        status = '❌ CODE ERROR';
      }
      if (response.includes('Cannot read properties')) {
        status = '❌ CRASH';
      }

      results.push({
        command: cmd,
        status,
        response: response.trim(),
      });

      console.log(`   ${status}`);
      console.log(`   📥 Réponse: ${response.slice(0, 150).replace(/\n/g, ' ')}...`);
    } else {
      results.push({
        command: cmd,
        status: '🔇 SANS RÉPONSE',
        response: '(timeout après 45s)',
      });
      console.log('   🔇 SANS RÉPONSE');
    }
  } catch (e) {
    results.push({
      command: cmd,
      status: '❌ ERREUR D\'ENVOI',
      response: e.message,
    });
    console.log(`   ❌ Erreur: ${e.message}`);
  }

  currentCmdIndex++;
  saveState(); // Sauvegarder après chaque test
  setTimeout(sendNextCommand, DELAY_BETWEEN);
}

async function generateAndSendReport() {
  const testJid = `${TEST_NUMBER}@s.whatsapp.net`;

  const ok = results.filter(r => r.status === '✅ OK').length;
  const erreur = results.filter(r => r.status.includes('❌')).length;
  const bug = results.filter(r => r.status.includes('⚠️')).length;
  const sansReponse = results.filter(r => r.status.includes('🔇')).length;

  // Générer le rapport
  let report = '═══════════════════════════════════════════════════════\n';
  report += '       RAPPORT DE TEST - DJOUSSE-TECH-MD\n';
  report += '═══════════════════════════════════════════════════════\n\n';
  report += `📅 Date: ${new Date().toLocaleString()}\n`;
  report += `📋 Total testé: ${results.length} commandes\n\n`;
  report += `✅ Fonctionnent: ${ok}\n`;
  report += `❌ Erreurs: ${erreur}\n`;
  report += `⚠️ Bugs: ${bug}\n`;
  report += `🔇 Sans réponse: ${sansReponse}\n`;
  report += '\n═══════════════════════════════════════════════════════\n';
  report += '                    DÉTAILS\n';
  report += '═══════════════════════════════════════════════════════\n\n';

  for (const r of results) {
    report += '───────────────────────────────────────────────────────\n';
    report += `📌 COMMANDE: ${r.command}\n`;
    report += `📊 STATUT: ${r.status}\n`;
    report += `📥 RÉPONSE DU BOT:\n${r.response}\n`;
    report += '───────────────────────────────────────────────────────\n\n';
  }

  // Sauvegarder en local
  const reportPath = path.join(__dirname, `test-report-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);

  // Envoyer le fichier .txt sur WhatsApp
  try {
    await sock.sendMessage(testJid, {
      document: fs.readFileSync(reportPath),
      fileName: `rapport-test-${Date.now()}.txt`,
      mimetype: 'text/plain',
      caption: `📊 Rapport de test DJOUSSE-TECH-MD\n\n✅ OK: ${ok} | ❌ Erreurs: ${erreur} | ⚠️ Bugs: ${bug} | 🔇 Sans réponse: ${sansReponse}`
    });
    console.log('📱 Fichier .txt envoyé sur WhatsApp !');
  } catch (e) {
    console.log('❌ Erreur envoi fichier:', e.message);
  }

  // Nettoyer l'état
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

async function start() {
  console.log('🚀 Démarrage du test DJOUSSE-TECH-MD\n');
  console.log(`📱 Bot: ${BOT_NUMBER}`);
  console.log(`📱 Testeur: ${TEST_NUMBER}`);
  console.log(`📋 Commandes: ${COMMANDS.length}`);
  console.log(`⏱️ Delay: ${DELAY_BETWEEN / 1000}s entre chaque commande\n`);

  // ✅ Charger l'état précédent
  loadState();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    auth: state,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  setupMessageHandler();

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Scanne le QR code avec WhatsApp\n');
    }

    if (connection === 'open') {
      console.log('✅ Connecté !');
      console.log(`📋 Reprise à la commande ${currentCmdIndex + 1}/${COMMANDS.length}\n`);
      setTimeout(sendNextCommand, 3000);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('🔄 Reconnexion...');
        setTimeout(start, 5000);
      } else {
        console.log('❌ Déconnecté (logged out)');
        process.exit(1);
      }
    }
  });

  // ✅ Gérer les erreurs non catchées
  process.on('unhandledRejection', (reason) => {
    console.log('⚠️ Rejection ignorée:', reason);
  });
}

start().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
