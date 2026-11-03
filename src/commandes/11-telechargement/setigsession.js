'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../_partage/config');
const style = require('../../config/style');
const sessionFile = path.join(require('../../config/paths').PLUGIN_DATA, 'ig_session.json');
const browserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function loadSession() {
  try {
    if (fs.existsSync(sessionFile)) {
      const stored = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      return stored.sessionid || '';
    }
  } catch {}
  return config.INSTAGRAM_SESSION || '';
}

function saveSession(sessionid) {
  try {
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({ sessionid }), 'utf8');
  } catch {}
}

module.exports = {
  commands: ['setigsession', 'igsession'],
  description: 'Set Instagram session cookie for downloads (owner only)',
  usage: '<sessionid_cookie_value>',
  permission: 'owner',
  group: true,
  private: true,
  run: async (sock, message, args, { jid, contextInfo, reply }) => {
    const sessionid = (args[0] || '').trim();
    if (!sessionid) {
      const configured = Boolean(loadSession());
      return reply(style.renderInfo([
        '🔐 Instagram Session Manager',
        '',
        `Current status: ${configured ? '✅ Session is set' : '❌ No session configured'}`,
        '',
        'Usage: .setigsession <your_sessionid>',
        '',
        'How to get it:',
        '1. Log in to Instagram on Chrome',
        '2. Press F12 → Application tab → Cookies → instagram.com',
        '3. Find the cookie named sessionid',
        '4. Copy its value and send it here',
        '',
        'Your session stays private on this server only.',
      ]));
    }

    saveSession(sessionid);

    let verified = false;
    try {
      const response = await axios.get('https://www.instagram.com/accounts/edit/', {
        headers: {
          'User-Agent': browserAgent,
          Cookie: `sessionid=${sessionid}`,
        },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: status => status < 400,
      });
      verified = response.status === 200 && !String(response.data || '').includes('"login_required"');
    } catch {}

    const messageLines = [
      `🔐 Instagram Session ${verified ? 'Verified ✅' : 'Saved ⚠️'}`,
      '',
      verified
        ? 'Session is valid and active. Downloads will now work reliably.'
        : 'Session saved, but verification was inconclusive. Try .ig <url> to confirm it works.',
      '',
      'Use .setigsession again to update or check status.',
    ];
    const rendered = verified
      ? style.renderSuccess(messageLines)
      : style.renderInfo(messageLines);
    return reply(rendered);
  },
};
