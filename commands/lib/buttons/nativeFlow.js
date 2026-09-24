/**
 * Native Flow pur Baileys (WhiskeySockets) — remplace gifted-btns
 * Référence : gist Iucasmaia (proto InteractiveMessage + relayMessage + biz/bot nodes)
 * DJOUSSE-TECH-MD
 */

const fs = require('fs');
const {
  proto,
  generateWAMessageFromContent,
  isJidGroup,
  prepareWAMessageMedia
} = require('@whiskeysockets/baileys');

const PRIVACY_MODE_TS_OFFSET = 77980457;

function getPrivacyModeTs() {
  return (Math.floor(Date.now() / 1000) - PRIVACY_MODE_TS_OFFSET).toString();
}

function createBaseBizAttrs() {
  return {
    actual_actors: '2',
    host_storage: '2',
    privacy_mode_ts: getPrivacyModeTs()
  };
}

function buildMixedNativeFlowBizNode() {
  return {
    tag: 'biz',
    attrs: createBaseBizAttrs(),
    content: [
      {
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [
          { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
        ]
      },
      {
        tag: 'quality_control',
        attrs: { source_type: 'third_party' }
      }
    ]
  };
}

function quickReply(displayText, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: displayText, id })
  };
}

function singleSelect(title, sections) {
  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify({ title, sections })
  };
}

function ctaUrl(displayText, url, merchantUrl) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: displayText,
      url,
      merchant_url: merchantUrl || url
    })
  };
}

function ctaCopy(displayText, copyCode) {
  return {
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({ display_text: displayText, copy_code: copyCode })
  };
}

function ctaCall(displayText, phoneNumber) {
  return {
    name: 'cta_call',
    buttonParamsJson: JSON.stringify({ display_text: displayText, phone_number: phoneNumber })
  };
}

function normalizeUserJid(sock) {
  const id = sock && sock.user && sock.user.id;
  if (!id) return undefined;
  return `${id.split(':')[0]}@s.whatsapp.net`;
}

async function buildHeader(sock, title, subtitle, image) {
  if (image) {
    let mediaSource;
    if (image.buffer) mediaSource = image.buffer;
    else if (image.path) mediaSource = fs.readFileSync(image.path);
    else if (image.url) mediaSource = { url: image.url };
    else return null;

    try {
      const media = await prepareWAMessageMedia(
        { image: mediaSource },
        { upload: sock.waUploadToServer }
      );
      return proto.Message.InteractiveMessage.Header.create({
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      });
    } catch (e) {
      console.warn('[NATIVE-FLOW] Upload image header échoué:', e.message);
      return title
        ? proto.Message.InteractiveMessage.Header.create({ title, subtitle: subtitle || '' })
        : null;
    }
  }

  if (title) {
    return proto.Message.InteractiveMessage.Header.create({
      title,
      subtitle: subtitle || ''
    });
  }
  return null;
}

/**
 * Envoie un message interactif nativeFlow.
 * @param {object} sock - WASocket Baileys
 * @param {string} jid
 * @param {object} opts
 * @param {Array<{name,buttonParamsJson}>} opts.buttons
 * @param {string} [opts.body]
 * @param {string} [opts.title]
 * @param {string} [opts.subtitle]
 * @param {string} [opts.footer]
 * @param {{buffer?,path?,url?}} [opts.image]
 * @param {object} [opts.quoted]
 * @returns {Promise<string>} messageId
 */
async function sendNativeFlow(sock, jid, opts = {}) {
  const { buttons = [], body = '', title, subtitle, footer = '', image, quoted } = opts;
  if (!buttons.length) throw new Error('sendNativeFlow: aucun bouton');

  const header = await buildHeader(sock, title, subtitle, image);

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    ...(header ? { header } : {}),
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: buttons.map(b =>
        proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
          name: b.name,
          buttonParamsJson: b.buttonParamsJson
        })
      ),
      messageParamsJson: '{}',
      messageVersion: 1
    }),
    ...(quoted && quoted.message
      ? {
          contextInfo: {
            stanzaId: quoted.key?.id,
            participant: quoted.key?.participant || (quoted.key?.fromMe ? undefined : quoted.key?.remoteJid),
            quotedMessage: quoted.message
          }
        }
      : {})
  });

  const userJid = normalizeUserJid(sock);
  const waMessage = generateWAMessageFromContent(
    jid,
    { interactiveMessage },
    { userJid }
  );

  const bizNode = buildMixedNativeFlowBizNode();
  const botNode = { tag: 'bot', attrs: { biz_bot: '1' } };
  const additionalNodes = isJidGroup(jid) ? [bizNode] : [botNode, bizNode];

  await sock.relayMessage(jid, waMessage.message, {
    messageId: waMessage.key.id,
    additionalNodes
  });

  return waMessage.key.id;
}

module.exports = {
  sendNativeFlow,
  quickReply,
  singleSelect,
  ctaUrl,
  ctaCopy,
  ctaCall,
  buildMixedNativeFlowBizNode
};
