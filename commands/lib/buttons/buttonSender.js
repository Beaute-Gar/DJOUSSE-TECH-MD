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
    await sock.sendMessage(jid, { text: lines.join('\n') });
  } catch (err) {
    console.error('[BUTTONS] Fallback texte échoué:', err.message);
  }
}

async function sendButtons(sock, jid, options = {}) {
  const cfg = config;
  const {
    title = cfg.defaultTitle,
    text = '',
    footer = cfg.defaultFooter,
    buttons = [],
    quoted = null
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
      await sendButtonsPkg(sock, jid, {
        title,
        text,
        footer,
        aimode,
        buttons: formattedButtons
      }, quoted ? { quoted } : undefined);

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

module.exports = {
  sendButtons,
  sendUrlButton,
  sendCopyButton,
  sendCallButton,
  sendQuickReply,
  fallbackText,
  isPrivate,
  isGroup,
  isLid,
  PRIVATE_SUFFIXES,
  GROUP_SUFFIXES
};
