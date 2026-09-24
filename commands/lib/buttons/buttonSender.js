/**
 * Moteur d'envoi de boutons WhatsApp
 * Utilise gifted-btns (déjà installé)
 * DJOUSSE-TECH-MD
 */

const config = require('./buttonConfig');

let sendButtonsPkg = null;
let sendInteractivePkg = null;

try {
  const gifted = require('gifted-btns');
  sendButtonsPkg = gifted.sendButtons;
  sendInteractivePkg = gifted.sendInteractiveMessage;
} catch (e) {
  console.warn('[BUTTONS] gifted-btns introuvable, fallback texte');
}

const PRIVATE_SUFFIXES = ['@s.whatsapp.net', '@lid'];
const GROUP_SUFFIXES = ['@g.us'];

function isPrivate(jid) {
  if (typeof jid !== 'string') return false;
  return PRIVATE_SUFFIXES.some(s => jid.endsWith(s));
}

function isGroup(jid) {
  if (typeof jid !== 'string') return false;
  return GROUP_SUFFIXES.some(s => jid.endsWith(s));
}

function isLid(jid) {
  return typeof jid === 'string' && jid.endsWith('@lid');
}

// ─────────────────────────────────────────────────────────────
// Socket vivant : Baileys 7 ws = wrapper (isOpen) ; en cas de
// reconnexion, global.__activeSock pointe sur la NOUVELLE instance
// ─────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isSockOpen(s) {
  try {
    return !!(s && ((s.ws && s.ws.isOpen === true) || (s.ws && s.ws.socket && s.ws.socket.readyState === 1)));
  } catch {
    return false;
  }
}

function pickLiveSock(preferred) {
  if (isSockOpen(preferred)) return preferred;
  const live = global.__activeSock;
  if (live && live !== preferred && isSockOpen(live)) return live;
  return null;
}

async function waitForOpenSock(preferred, timeoutMs = 30000, intervalMs = 800) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const s = pickLiveSock(preferred);
    if (s) return s;
    if (Date.now() >= deadline) return null;
    await sleep(intervalMs);
  }
}

const CONN_ERR = /connection|closed|terminat|stream|writ(e|ing)|socket/i;

async function fallbackText(sock, jid, options) {
  const { title = '', text = '', footer = '', buttons = [] } = options;
  const lines = [];
  if (title) lines.push(`*${title}*`);
  if (text) lines.push(text);
  lines.push('');
  buttons.forEach((b, i) => {
    lines.push(`${i + 1}\uFE0F\u20E3 ${b.text || b.displayText || 'Option'}`);
  });
  if (footer) {
    lines.push('');
    lines.push(`_${footer}_`);
  }
  try {
    const live = (await waitForOpenSock(sock, 20000)) || sock;
    await live.sendMessage(jid, { text: lines.join('\n') });
    return true;
  } catch (err) {
    console.error('[BUTTONS] Fallback texte échoué:', err.message);
    return false;
  }
}

async function sendButtons(sock, jid, options = {}) {
  const cfg = config;
  const {
    title = cfg.defaultTitle,
    text = '',
    footer = cfg.defaultFooter,
    buttons = [],
    quoted = null,
    image = null
  } = options;

  if (!cfg.enabled) {
    return fallbackText(sock, jid, { title, text, footer, buttons });
  }

  let btns = Array.isArray(buttons) ? buttons : [];
  if (!btns.length) {
    return fallbackText(sock, jid, { title, text, footer, buttons: [] });
  }

  if (btns.length > cfg.maxButtons) {
    btns = btns.slice(0, cfg.maxButtons);
  }

  const formattedButtons = btns.map(b => ({
    id: b.id || `${cfg.prefix}${Date.now()}`,
    text: b.text || b.displayText || 'Option'
  }));

  const aimode = isPrivate(jid) ? cfg.aimodePrivate : cfg.aimodeGroup;

  try {
    if (sendButtonsPkg) {
      const doSend = async (target) => sendButtonsPkg(target, jid, {
        title,
        text,
        footer,
        aimode,
        ...(image ? { image } : {}),
        buttons: formattedButtons
      }, quoted ? { quoted } : undefined);

      let live = await waitForOpenSock(sock);
      if (!live) throw new Error('Socket fermé — pas de reconnexion disponible');

      try {
        await doSend(live);
      } catch (err) {
        if (!CONN_ERR.test(err.message || '')) throw err;
        console.warn(`[BUTTONS] Envoi interrompu (${err.message}) — attente reconnexion…`);
        live = await waitForOpenSock(live, 30000);
        if (!live) throw err;
        await doSend(live);
      }

      if (cfg.logClicks) {
        console.log(`[BUTTONS] Envoyé à ${jid} (${formattedButtons.length} boutons)`);
      }
      return true;
    }
  } catch (err) {
    console.error('[BUTTONS] sendButtons échoué:', err.message);
  }

  if (cfg.fallbackToText) {
    return fallbackText(sock, jid, { title, text, footer, buttons: formattedButtons });
  }
  return false;
}

async function sendUrlButton(sock, jid, options = {}) {
  const {
    title = config.defaultTitle,
    text = '',
    footer = config.defaultFooter,
    url = 'https://example.com',
    displayText = 'Ouvrir le lien',
    quoted = null
  } = options;

  if (!sendInteractivePkg) {
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText} -> ${url}` }]
    });
  }

  const privateChat = isPrivate(jid);
  const aimode = privateChat ? config.aimodePrivate : config.aimodeGroup;

  try {
    await sendInteractivePkg(sock, jid, {
      title,
      text,
      footer,
      aimode,
      interactiveButtons: [
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({ display_text: displayText, url })
        }
      ]
    }, quoted ? { quoted } : undefined);

    if (config.logClicks) {
      console.log(`[BUTTONS] URL envoyé à ${jid} (aimode=${aimode})`);
    }
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendUrlButton échoué:', err.message);
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText} -> ${url}` }]
    });
  }
}

async function sendCopyButton(sock, jid, options = {}) {
  const {
    title = config.defaultTitle,
    text = '',
    footer = config.defaultFooter,
    copyCode = '',
    displayText = 'Copier',
    quoted = null
  } = options;

  if (!sendInteractivePkg) {
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText}: ${copyCode}` }]
    });
  }

  const privateChat = isPrivate(jid);
  const aimode = privateChat ? config.aimodePrivate : config.aimodeGroup;

  try {
    await sendInteractivePkg(sock, jid, {
      title,
      text,
      footer,
      aimode,
      interactiveButtons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({ display_text: displayText, copy_code: copyCode })
        }
      ]
    }, quoted ? { quoted } : undefined);

    if (config.logClicks) {
      console.log(`[BUTTONS] Copier envoyé à ${jid} (aimode=${aimode})`);
    }
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendCopyButton échoué:', err.message);
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText}: ${copyCode}` }]
    });
  }
}

async function sendCallButton(sock, jid, options = {}) {
  const {
    title = config.defaultTitle,
    text = '',
    footer = config.defaultFooter,
    phoneNumber = '',
    displayText = 'Appeler',
    quoted = null
  } = options;

  if (!sendInteractivePkg) {
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText}: ${phoneNumber}` }]
    });
  }

  const privateChat = isPrivate(jid);
  const aimode = privateChat ? config.aimodePrivate : config.aimodeGroup;

  try {
    await sendInteractivePkg(sock, jid, {
      title,
      text,
      footer,
      aimode,
      interactiveButtons: [
        {
          name: 'cta_call',
          buttonParamsJson: JSON.stringify({ display_text: displayText, phone_number: phoneNumber })
        }
      ]
    }, quoted ? { quoted } : undefined);

    if (config.logClicks) {
      console.log(`[BUTTONS] Appel envoyé à ${jid} (aimode=${aimode})`);
    }
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendCallButton échoué:', err.message);
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: [{ text: `${displayText}: ${phoneNumber}` }]
    });
  }
}

async function sendQuickReply(sock, jid, options = {}) {
  return sendButtons(sock, jid, options);
}

// ─────────────────────────────────────────────────────────────
// Envoi d'un message interactif NATIVE FLOW
// Permet single_select jusqu'à 10 items
// ─────────────────────────────────────────────────────────────
async function sendInteractiveMessage(sock, jid, options = {}) {
  const {
    text = '',
    footer = config.defaultFooter,
    interactiveButtons = [],
    quoted = null
  } = options;

  if (!sendInteractivePkg) {
    console.warn('[BUTTONS] sendInteractiveMessage indisponible, fallback texte');
    return fallbackText(sock, jid, {
      title: '',
      text,
      footer,
      buttons: interactiveButtons.map(b => ({ text: b.name }))
    });
  }

  const privateChat = isPrivate(jid);
  const aimode = privateChat ? config.aimodePrivate : config.aimodeGroup;

  try {
    await sendInteractivePkg(sock, jid, {
      text,
      footer,
      aimode,
      interactiveButtons
    }, quoted ? { quoted } : undefined);

    if (config.logClicks) {
      console.log(`[BUTTONS] NativeFlow envoyé à ${jid} (aimode=${aimode})`);
    }
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendInteractiveMessage échoué:', err.message);
    return fallbackText(sock, jid, {
      title: '',
      text,
      footer,
      buttons: []
    });
  }
}

module.exports = {
  sendButtons,
  sendUrlButton,
  sendCopyButton,
  sendCallButton,
  sendQuickReply,
  sendInteractiveMessage,
  fallbackText,
  isPrivate,
  isGroup,
  isLid,
  PRIVATE_SUFFIXES,
  GROUP_SUFFIXES
};
