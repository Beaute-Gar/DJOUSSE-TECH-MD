import { listChats as listChatsBridge, getChat as getChatBridge, getChatMessages as getChatMessagesBridge, deleteChat as deleteChatBridge, clearChat as clearChatBridge } from '../bridge.js';

export async function listChats(sock, req, res) {
  try {
    const chats = await listChatsBridge(sock);
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const paginated = chats.slice(offset, offset + limit);
    res.json({ messages: paginated, meta: { count: paginated.length, total: chats.length } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CHATS_FETCH_FAILED' });
  }
}

export async function getChat(sock, req, res) {
  try {
    const chatId = req.params.id;
    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    const chat = await getChatBridge(sock, jid);
    if (!chat) return res.status(404).json({ error: true, message: 'Chat not found', code: 'NOT_FOUND' });
    res.json({ messages: [chat], meta: { count: 1 } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CHAT_FETCH_FAILED' });
  }
}

export async function deleteChat(sock, req, res) {
  try {
    const chatId = req.params.id;
    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    await deleteChatBridge(sock, jid);
    res.json({ sent: true, message: `Chat ${jid} deleted` });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CHAT_DELETE_FAILED' });
  }
}

export async function getChatMessages(sock, req, res) {
  try {
    const chatId = req.params.id;
    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await getChatMessagesBridge(sock, jid, limit);
    res.json({ messages, meta: { count: messages.length } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'MESSAGES_FETCH_FAILED' });
  }
}

export async function clearChat(sock, req, res) {
  try {
    const { chat_id } = req.body;
    if (!chat_id) return res.status(400).json({ error: true, message: 'Missing required field: chat_id', code: 'INVALID_PARAMS' });
    const jid = chat_id.includes('@') ? chat_id : `${chat_id}@s.whatsapp.net`;
    await clearChatBridge(sock, jid);
    res.json({ sent: true, message: `Chat ${jid} cleared` });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CHAT_CLEAR_FAILED' });
  }
}