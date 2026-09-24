/**
 * Moteur d'envoi de boutons WhatsApp
 * Native Flow pur Baileys (WhiskeySockets) — remplace gifted-btns
 * Référence : gist Iucasmaia
 * DJOUSSE-TECH-MD
 */

const config = require('./buttonConfig');
const {
  sendNativeFlow,
  quickReply,
  singleSelect,
  ctaUrl,
  ctaCopy,
  ctaCall
} = require('./nativeFlow');

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
    if (b.type === 'list') {
      lines.push(`📋 ${b.text || 'Ouvrir la liste'}`);
    } else {
      lines.push(`${i + 1}\uFE0F\u20E3 ${b.text || b.displayText || 'Option'}`);
    }
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

function buildFlowButtons(btns, maxButtons) {
  const flow = [];
  for (const b of btns) {
    if (b.type === 'list') {
      flow.push(singleSelect(
        (b.list && b.list.title) || b.text || 'Options',
        (b.list && b.list.sections) || []
      ));
    } else {
      flow.push(quickReply(b.text || b.displayText || 'Option', b.id || `${config.prefix}${Date.now()}`));
    }
    if (flow.length >= maxButtons + 1) break; // 1 liste + max quick_reply
  }
  return flow;
}

async function relayWithRetry(sock, jid, flowOpts) {
  let live = await waitForOpenSock(sock);
  if (!live) throw new Error('Socket fermé — pas de reconnexion disponible');
  try {
    await sendNativeFlow(live, jid, flowOpts);
  } catch (err) {
    if (!CONN_ERR.test(err.message || '')) throw err;
    console.warn(`[BUTTONS] Envoi interrompu (${err.message}) — attente reconnexion…`);
    live = await waitForOpenSock(live, 30000);
    if (!live) throw err;
    await sendNativeFlow(live, jid, flowOpts);
  }
  return live;
}

async function sendButtons(sock, jid, options = {}) {
  const cfg = config;
  const {
    title = '',
    text = '',
    footer = cfg.defaultFooter,
    buttons = [],
    quoted = null,
    image = null
  } = options;

  if (!cfg.enabled) {
    return fallbackText(sock, jid, { title, text, footer, buttons });
  }

  const btns = Array.isArray(buttons) ? buttons : [];
  if (!btns.length) {
    return fallbackText(sock, jid, { title, text, footer, buttons: [] });
  }

  try {
    const flowButtons = buildFlowButtons(btns, cfg.maxButtons);
    await relayWithRetry(sock, jid, {
      body: text,
      title,
      footer,
      image,
      quoted,
      buttons: flowButtons
    });

    if (cfg.logClicks) {
      console.log(`[BUTTONS] Envoyé à ${jid} (${flowButtons.length} bouton(s) nativeFlow)`);
    }
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendButtons échoué:', err.message);
  }

  if (cfg.fallbackToText) {
    return fallbackText(sock, jid, { title, text, footer, buttons: btns });
  }
  return false;
}

async function sendUrlButton(sock, jid, options = {}) {
  const {
    title = '',
    text = '',
    footer = config.defaultFooter,
    url = 'https://example.com',
    displayText = 'Ouvrir le lien',
    quoted = null
  } = options;

  try {
    await relayWithRetry(sock, jid, {
      body: text,
      title,
      footer,
      quoted,
      buttons: [ctaUrl(displayText, url)]
    });
    if (config.logClicks) console.log(`[BUTTONS] URL envoyé à ${jid}`);
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
    title = '',
    text = '',
    footer = config.defaultFooter,
    copyCode = '',
    displayText = 'Copier',
    quoted = null
  } = options;

  try {
    await relayWithRetry(sock, jid, {
      body: text,
      title,
      footer,
      quoted,
      buttons: [ctaCopy(displayText, copyCode)]
    });
    if (config.logClicks) console.log(`[BUTTONS] Copier envoyé à ${jid}`);
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
    title = '',
    text = '',
    footer = config.defaultFooter,
    phoneNumber = '',
    displayText = 'Appeler',
    quoted = null
  } = options;

  try {
    await relayWithRetry(sock, jid, {
      body: text,
      title,
      footer,
      quoted,
      buttons: [ctaCall(displayText, phoneNumber)]
    });
    if (config.logClicks) console.log(`[BUTTONS] Appel envoyé à ${jid}`);
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
// Envoi d'un message interactif NATIVE FLOW (boutons bruts)
// ─────────────────────────────────────────────────────────────
async function sendInteractiveMessage(sock, jid, options = {}) {
  const {
    title = '',
    text = '',
    footer = config.defaultFooter,
    interactiveButtons = [],
    quoted = null
  } = options;

  if (!interactiveButtons.length) {
    return fallbackText(sock, jid, { title, text, footer, buttons: [] });
  }

  const raw = interactiveButtons.map(b =>
    b.buttonParamsJson
      ? { name: b.name, buttonParamsJson: b.buttonParamsJson }
      : null
  ).filter(Boolean);

  if (!raw.length) {
    return fallbackText(sock, jid, { title, text, footer, buttons: [] });
  }

  try {
    await relayWithRetry(sock, jid, {
      body: text,
      title,
      footer,
      quoted,
      buttons: raw
    });
    if (config.logClicks) console.log(`[BUTTONS] NativeFlow envoyé à ${jid}`);
    return true;
  } catch (err) {
    console.error('[BUTTONS] sendInteractiveMessage échoué:', err.message);
    return fallbackText(sock, jid, {
      title, text, footer,
      buttons: raw.map(b => ({ text: b.name }))
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
  waitForOpenSock,
  PRIVATE_SUFFIXES,
  GROUP_SUFFIXES
};
