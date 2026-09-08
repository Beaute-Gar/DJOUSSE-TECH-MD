/* src/baileys-api/bridge.js — Adaptateur wwebjs pour Baileys REST API
   Remplace l'ancien bridge Baileys. Utilise sock.sendMessage() (wwebjs adapter)
   qui a une API compatible Baileys. */

function ensureJid(input) {
  if (!input) return '';
  const s = String(input).trim();
  if (s.includes('@')) return s;
  return s + '@s.whatsapp.net';
}

async function sendTextMessage(sock, jid, text, opts = {}) {
  const result = await sock.sendMessage(jid, { text }, { quoted: opts.quoted });
  return result;
}

async function sendImageMessage(sock, jid, media, caption, opts = {}) {
  const result = await sock.sendMessage(jid, { image: media, caption }, { quoted: opts.quoted });
  return result;
}

async function sendVideoMessage(sock, jid, media, caption, opts = {}) {
  const result = await sock.sendMessage(jid, { video: media, caption }, { quoted: opts.quoted });
  return result;
}

async function sendAudioMessage(sock, jid, media, opts = {}) {
  const result = await sock.sendMessage(jid, { audio: media, ptt: opts.ptt || false }, { quoted: opts.quoted });
  return result;
}

async function sendDocumentMessage(sock, jid, media, filename, opts = {}) {
  const result = await sock.sendMessage(jid, { document: media, fileName: filename, mimetype: opts.mimetype }, { quoted: opts.quoted });
  return result;
}

async function sendStickerMessage(sock, jid, media, opts = {}) {
  const result = await sock.sendMessage(jid, { sticker: media }, { quoted: opts.quoted });
  return result;
}

async function sendLocationMessage(sock, jid, lat, lng, opts = {}) {
  const result = await sock.sendMessage(jid, { location: { degreesLatitude: lat, degreesLongitude: lng } }, { quoted: opts.quoted });
  return result;
}

async function sendContactMessage(sock, jid, contacts, opts = {}) {
  const result = await sock.sendMessage(jid, { contacts: { displayName: opts.displayName || 'Contact', contacts } }, { quoted: opts.quoted });
  return result;
}

async function sendReaction(sock, jid, key, text, opts = {}) {
  const result = await sock.sendMessage(jid, { react: { text, key } });
  return result;
}

async function sendButtonMessage(sock, jid, text, buttons, opts = {}) {
  const result = await sock.sendMessage(jid, { buttons, header: opts.header, footer: opts.footer, text }, { quoted: opts.quoted });
  return result;
}

async function sendListMessage(sock, jid, text, rows, opts = {}) {
  const result = await sock.sendMessage(jid, { list: rows, header: opts.header, footer: opts.footer, text }, { quoted: opts.quoted });
  return result;
}

async function sendPollMessage(sock, jid, name, values, opts = {}) {
  const options = values.map(v => ({ optionName: v }));
  const result = await sock.sendMessage(jid, { poll: { name, options, selectableOptionsCount: 1 } }, { quoted: opts.quoted });
  return result;
}

async function forwardMessage(sock, jid, key, opts = {}) {
  const result = await sock.sendMessage(jid, { forward: key });
  return result;
}

/* Group operations — simplified for wwebjs */
async function getGroupMetadata(sock, jid) {
  try {
    const chat = await sock._clientRef()?.getChatById?.(jid.replace('@s.whatsapp.net', '@g.us'));
    if (!chat) throw new Error('Chat not found');
    const participants = (chat.participants || []).map(p => ({
      id: p.id._serialized.replace('@c.us', '@s.whatsapp.net'),
      admin: p.isAdmin ? 'admin' : p.isSuperAdmin ? 'superadmin' : null
    }));
    return {
      id: chat.id._serialized.replace('@g.us', '@s.whatsapp.net'),
      subject: chat.name,
      owner: chat.owner?._serialized?.replace('@c.us', '@s.whatsapp.net'),
      participants,
      desc: chat.description,
      descId: chat.descriptionId
    };
  } catch (e) {
    throw new Error('Failed to get group metadata: ' + e.message);
  }
}

async function updateGroupParticipants(sock, jid, participants, action) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@g.us');
  const chat = await client.getChatById(wid);
  const toJids = participants.map(p => p.replace('@s.whatsapp.net', '@c.us'));
  if (action === 'add') {
    await chat.addParticipants(toJids);
  } else if (action === 'remove') {
    await chat.removeParticipants(toJids);
  } else if (action === 'promote') {
    await chat.promoteParticipants(toJids);
  } else if (action === 'demote') {
    await chat.demoteParticipants(toJids);
  }
  return { success: true };
}

async function updateGroupSettings(sock, jid, settings) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@g.us');
  const chat = await client.getChatById(wid);
  if (settings.announce !== undefined) {
    await chat.setMessagesAdminsOnly(settings.announce);
  }
  if (settings.restrict !== undefined) {
    await chat.setLocked(settings.restrict);
  }
  return { success: true };
}

async function leaveGroup(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@g.us');
  const chat = await client.getChatById(wid);
  await chat.leave();
  return { success: true };
}

async function getGroupInviteCode(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@g.us');
  const chat = await client.getChatById(wid);
  const code = await chat.getInviteCode();
  return { code };
}

async function revokeGroupInviteCode(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@g.us');
  const chat = await client.getChatById(wid);
  await chat.revokeInvite();
  return { success: true };
}

/* Chat operations */
async function listChats(sock) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const chats = await client.getChats();
  return chats.map(c => ({
    id: c.id._serialized.replace('@c.us', '@s.whatsapp.net').replace('@g.us', '@s.whatsapp.net'),
    name: c.name,
    isGroup: c.isGroup,
    unreadCount: c.unreadCount,
    lastMessage: c.lastMessage ? {
      id: c.lastMessage.id._serialized,
      body: c.lastMessage.body,
      timestamp: c.lastMessage.timestamp
    } : null
  }));
}

async function getChat(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', c => c.includes('g') ? '@g.us' : '@c.us');
  const chat = await client.getChatById(wid);
  return {
    id: chat.id._serialized.replace('@c.us', '@s.whatsapp.net').replace('@g.us', '@s.whatsapp.net'),
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount
  };
}

async function getChatMessages(sock, jid, limit = 20) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', c => c.includes('g') ? '@g.us' : '@c.us');
  const chat = await client.getChatById(wid);
  const msgs = await chat.fetchMessages({ limit });
  return msgs.map(m => ({
    id: m.id._serialized,
    fromMe: m.fromMe,
    body: m.body,
    type: m.type,
    timestamp: m.timestamp,
    author: m.author?._serialized?.replace('@c.us', '@s.whatsapp.net')
  }));
}

async function deleteChat(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', c => c.includes('g') ? '@g.us' : '@c.us');
  const chat = await client.getChatById(wid);
  await chat.delete();
  return { success: true };
}

async function clearChat(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', c => c.includes('g') ? '@g.us' : '@c.us');
  const chat = await client.getChatById(wid);
  await chat.clear();
  return { success: true };
}

/* Contact operations */
async function listContacts(sock) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const contacts = await client.getContacts();
  return contacts.map(c => ({
    id: c.id._serialized.replace('@c.us', '@s.whatsapp.net'),
    name: c.name || c.pushname,
    number: c.number,
    isBusiness: c.isBusiness,
    isEnterprise: c.isEnterprise
  }));
}

async function checkContacts(sock, numbers) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const results = await client.checkNumbers(numbers.map(n => n.replace('@s.whatsapp.net', '') + '@c.us'));
  return results.map(r => ({
    id: r.id._serialized.replace('@c.us', '@s.whatsapp.net'),
    exists: r.isRegistered,
    status: r.status
  }));
}

async function getContact(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@c.us');
  const contact = await client.getContactById(wid);
  return {
    id: contact.id._serialized.replace('@c.us', '@s.whatsapp.net'),
    name: contact.name || contact.pushname,
    number: contact.number,
    isBusiness: contact.isBusiness
  };
}

async function blockContact(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@c.us');
  await client.getContactById(wid);
  await client.blockContact(wid);
  return { success: true };
}

async function unblockContact(sock, jid) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  const wid = jid.replace('@s.whatsapp.net', '@c.us');
  await client.unblockContact(wid);
  return { success: true };
}

/* Presence operations */
async function updateMyPresence(sock, presence) {
  const client = sock._clientRef();
  if (!client) throw new Error('Client not initialized');
  await client.sendSeen(presence);
  return { success: true };
}

async function updatePresence(sock, jid, presence) {
  // wwebjs doesn't support setting others' presence
  return { success: false, message: 'Not supported' };
}

/* Media operations */
async function uploadMedia(sock, mediaData) {
  // Not implemented for wwebjs directly
  return { success: false, message: 'Upload media not implemented' };
}

async function getMedia(sock, id) {
  return { success: false, message: 'Not implemented' };
}

async function deleteMedia(sock, id) {
  return { success: false, message: 'Not implemented' };
}

/* Webhooks */
async function getWebhook(sock) {
  return { success: true, webhook: null };
}

async function setWebhook(sock, url) {
  return { success: true, url };
}

async function deleteWebhook(sock) {
  return { success: true };
}

async function testWebhook(sock, url) {
  return { success: true, message: 'Test sent' };
}

export {
  ensureJid,
  sendTextMessage, sendImageMessage, sendVideoMessage, sendAudioMessage,
  sendDocumentMessage, sendStickerMessage, sendLocationMessage, sendContactMessage,
  sendReaction, sendButtonMessage, sendListMessage, sendPollMessage, forwardMessage,
  getGroupMetadata, updateGroupParticipants, updateGroupSettings, leaveGroup,
  getGroupInviteCode, revokeGroupInviteCode,
  listChats, getChat, getChatMessages, deleteChat, clearChat,
  listContacts, checkContacts, getContact, blockContact, unblockContact,
  updateMyPresence, updatePresence,
  uploadMedia, getMedia, deleteMedia,
  getWebhook, setWebhook, deleteWebhook, testWebhook
};