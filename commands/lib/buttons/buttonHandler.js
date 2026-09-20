/**
 * Gestionnaire des clics sur boutons
 * DJOUSSE-TECH-MD
 */

const config = require('./buttonConfig');
const { sendButtons } = require('./buttonSender');

function extractButtonId(message) {
  const msg = message.message;
  if (!msg) return null;

  if (msg.buttonsResponseMessage) {
    return msg.buttonsResponseMessage.selectedButtonId || null;
  }

  if (msg.interactiveResponseMessage) {
    try {
      const native = msg.interactiveResponseMessage.nativeFlowResponseMessage;
      if (native && native.paramsJson) {
        const parsed = JSON.parse(native.paramsJson);
        return parsed.id || null;
      }
    } catch (e) {
      console.warn('[BUTTONS] Parse nativeFlowResponse échoué');
    }
    return msg.interactiveResponseMessage.selectedButtonId || null;
  }

  if (msg.templateButtonReplyMessage) {
    return msg.templateButtonReplyMessage.selectedId || null;
  }

  return null;
}

function isButtonResponse(message) {
  return extractButtonId(message) !== null;
}

async function handleButtonClick(sock, message) {
  const jid = message.key.remoteJid;
  const buttonId = extractButtonId(message);

  if (!buttonId) return false;

  if (config.logClicks) {
    console.log(`[BUTTONS] Clic: "${buttonId}" depuis ${jid}`);
  }

  try {
    switch (buttonId) {
      case 'btn_ping':
      case 'btn_ping_again':
        return await handlePing(sock, jid, message);

      case 'btn_info':
        return await handleInfo(sock, jid, message);

      case 'btn_site':
        return await handleSite(sock, jid, message);

      case 'btn_back_menu':
        return await handleBackMenu(sock, jid, message);

      case 'btn_support':
        return await handleSupport(sock, jid, message);

      case 'btn_channel':
        return await handleChannel(sock, jid, message);

      case 'btn_help':
        return await handleHelp(sock, jid, message);

      default:
        await sock.sendMessage(jid, {
          text: `Option inconnue: *${buttonId}*\nTapez /menu pour revenir.`
        }, { quoted: message });
        return true;
    }
  } catch (err) {
    console.error('[BUTTONS] Erreur handleButtonClick:', err.message);
    await sock.sendMessage(jid, {
      text: 'Une erreur est survenue. Tapez /menu.'
    }, { quoted: message });
    return true;
  }
}

async function handlePing(sock, jid, message) {
  const start = Date.now();
  await sock.sendMessage(jid, { text: 'Calcul...' });
  const latency = Date.now() - start;

  await sendButtons(sock, jid, {
    title: 'PING',
    text: `Pong !\n\nLatence: *${latency} ms*`,
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'btn_ping_again', text: 'Relancer' },
      { id: 'btn_back_menu', text: 'Menu' }
    ],
    quoted: message
  });
  return true;
}

async function handleInfo(sock, jid, message) {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const mem = (process.memoryUsage().rss / 1048576).toFixed(1);

  await sendButtons(sock, jid, {
    title: 'INFORMATIONS',
    text: `*DJOUSSE-TECH-MD*\n\nVersion: 3.1.0\nUptime: ${h}h ${m}m\nRAM: ${mem} MB\nStatut: En ligne`,
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'btn_support', text: 'Support' },
      { id: 'btn_back_menu', text: 'Menu' }
    ],
    quoted: message
  });
  return true;
}

async function handleSite(sock, jid, message) {
  await sock.sendMessage(jid, {
    text: '🌐 Site: https://github.com/Beaute-Gar/DJOUSSE-TECH-MD'
  }, { quoted: message });
  return true;
}

async function handleBackMenu(sock, jid, message) {
  const { sendUrlButton } = require('./buttonSender');
  await sendButtons(sock, jid, {
    title: 'MENU PRINCIPAL',
    text: 'Choisissez une option:',
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'btn_ping', text: 'Ping' },
      { id: 'btn_info', text: 'Infos' },
      { id: 'btn_site', text: 'Site' }
    ],
    quoted: message
  });
  return true;
}

async function handleSupport(sock, jid, message) {
  await sock.sendMessage(jid, {
    text: '*Support DJOUSSE-TECH-MD*\n\nGitHub: https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/issues'
  }, { quoted: message });
  return true;
}

async function handleChannel(sock, jid, message) {
  await sock.sendMessage(jid, {
    text: '📢 Canal: https://whatsapp.com/channel/...'
  }, { quoted: message });
  return true;
}

async function handleHelp(sock, jid, message) {
  await sendButtons(sock, jid, {
    title: 'AIDE',
    text: 'Tapez /menu pour voir toutes les commandes.\nTapez /ping pour tester le bot.',
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'btn_back_menu', text: 'Menu' },
      { id: 'btn_info', text: 'Infos' }
    ],
    quoted: message
  });
  return true;
}

module.exports = {
  handleButtonClick,
  isButtonResponse,
  extractButtonId
};
