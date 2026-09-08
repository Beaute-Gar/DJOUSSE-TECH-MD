let nodejs = null;
try {
  nodejs = require('nodejs-mobile-react-native');
} catch { /* module disponible uniquement sur Android/React Native */ }

function sendStatus(status, pairingCode = null, log = null) {
  if (nodejs && nodejs.channel) {
    nodejs.channel.send({
      type: 'BOT_STATUS_UPDATE',
      status,
      pairingCode,
      log
    });
  } else {
    console.log(`[BRIDGE] Status: ${status}, Code: ${pairingCode}, Log: ${log}`);
  }
}

module.exports = {
  sendStatus
};
