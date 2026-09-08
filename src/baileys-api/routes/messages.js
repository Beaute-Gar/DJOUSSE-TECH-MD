import {
  ensureJid, sendTextMessage, sendImageMessage, sendVideoMessage,
  sendAudioMessage, sendDocumentMessage, sendStickerMessage,
  sendLocationMessage, sendContactMessage, sendReaction,
  sendButtonMessage, sendListMessage, sendPollMessage, forwardMessage,
} from '../bridge.js';

export default function messageRoutes(sock) {
  const router = (req, res) => {
    const { method, path: routePath } = req;
    if (routePath === '/messages/text' && method === 'POST') return postText(req, res);
    if (routePath === '/messages/image' && method === 'POST') return postImage(req, res);
    if (routePath === '/messages/video' && method === 'POST') return postVideo(req, res);
    if (routePath === '/messages/audio' && method === 'POST') return postAudio(req, res);
    if (routePath === '/messages/document' && method === 'POST') return postDocument(req, res);
    if (routePath === '/messages/sticker' && method === 'POST') return postSticker(req, res);
    if (routePath === '/messages/location' && method === 'POST') return postLocation(req, res);
    if (routePath === '/messages/contact' && method === 'POST') return postContact(req, res);
    if (routePath === '/messages/reaction' && method === 'POST') return postReaction(req, res);
    if (routePath === '/messages/buttons' && method === 'POST') return postButtons(req, res);
    if (routePath === '/messages/list' && method === 'POST') return postList(req, res);
    if (routePath === '/messages/poll' && method === 'POST') return postPoll(req, res);
    if (routePath === '/messages/forward' && method === 'POST') return postForward(req, res);
    return res.status(405).json({ error: true, message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  };

  router.postText = postText;
  router.postImage = postImage;
  router.postVideo = postVideo;
  router.postAudio = postAudio;
  router.postDocument = postDocument;
  router.postSticker = postSticker;
  router.postLocation = postLocation;
  router.postContact = postContact;
  router.postReaction = postReaction;
  router.postButtons = postButtons;
  router.postList = postList;
  router.postPoll = postPoll;
  router.postForward = postForward;

  return router;
}

async function postText(req, res) {
  try {
    const { to, text, preview_url, quoted } = req.body;
    if (!to || !text) return res.status(400).json({ error: true, message: 'Missing required fields: to, text', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendTextMessage(sock, jid, text, { previewUrl: preview_url, quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postImage(req, res) {
  try {
    const { to, media, caption, quoted } = req.body;
    if (!to || !media) return res.status(400).json({ error: true, message: 'Missing required fields: to, media', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendImageMessage(sock, jid, media, caption || '', { quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postVideo(req, res) {
  try {
    const { to, media, caption, quoted } = req.body;
    if (!to || !media) return res.status(400).json({ error: true, message: 'Missing required fields: to, media', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendVideoMessage(sock, jid, media, caption || '', { quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postAudio(req, res) {
  try {
    const { to, media, ptt, quoted } = req.body;
    if (!to || !media) return res.status(400).json({ error: true, message: 'Missing required fields: to, media', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendAudioMessage(sock, jid, media, { ptt: ptt || false, quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postDocument(req, res) {
  try {
    const { to, media, filename, mimetype, quoted } = req.body;
    if (!to || !media) return res.status(400).json({ error: true, message: 'Missing required fields: to, media', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendDocumentMessage(sock, jid, media, filename || 'document.bin', { mimetype, quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postSticker(req, res) {
  try {
    const { to, media, quoted } = req.body;
    if (!to || !media) return res.status(400).json({ error: true, message: 'Missing required fields: to, media', code: 'INVALID_PARAMS' });
    const jid = ensureJid(to);
    const result = await sendStickerMessage(sock, jid, media, { quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postLocation(req, res) {
  try {
    const { to, latitude, longitude, quoted } = req.body;
    if (!to || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, latitude, longitude', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendLocationMessage(sock, jid, latitude, longitude, { quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postContact(req, res) {
  try {
    const { to, contacts, quoted } = req.body;
    if (!to || !contacts || !contacts.length) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, contacts', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendContactMessage(sock, jid, contacts, { quoted });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postReaction(req, res) {
  try {
    const { to, message_id, emoji } = req.body;
    if (!to || !message_id || !emoji) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, message_id, emoji', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendReaction(sock, jid, message_id, emoji);
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postButtons(req, res) {
  try {
    const { to, text, buttons } = req.body;
    if (!to || !text || !buttons || !buttons.length) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, text, buttons', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendButtonMessage(sock, jid, text, buttons);
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postList(req, res) {
  try {
    const { to, text, button_text, sections } = req.body;
    if (!to || !text || !sections || !sections.length) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, text, sections', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendListMessage(sock, jid, text, button_text, sections);
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postPoll(req, res) {
  try {
    const { to, question, options, selectable_count } = req.body;
    if (!to || !question || !options || !options.length) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, question, options', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const result = await sendPollMessage(sock, jid, question, options, { selectableCount: selectable_count || 1 });
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}

async function postForward(req, res) {
  try {
    const { to, message_id, from } = req.body;
    if (!to || !message_id) {
      return res.status(400).json({ error: true, message: 'Missing required fields: to, message_id', code: 'INVALID_PARAMS' });
    }
    const jid = ensureJid(to);
    const fromJid = from ? ensureJid(from) : jid;
    const result = await forwardMessage(sock, jid, message_id, fromJid);
    res.json({ sent: true, message: result });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'SEND_FAILED' });
  }
}
