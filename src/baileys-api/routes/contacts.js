import { ensureJid, listContacts as listContactsBridge, checkContacts as checkContactsBridge, getContact as getContactBridge, blockContact as blockContactBridge, unblockContact as unblockContactBridge } from '../bridge.js';

export async function listContacts(sock, req, res) {
  try {
    const contacts = await listContactsBridge(sock);
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const paginated = contacts.slice(offset, offset + limit);
    res.json({ messages: paginated, meta: { count: paginated.length, total: contacts.length } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CONTACTS_FETCH_FAILED' });
  }
}

export async function checkContacts(sock, req, res) {
  try {
    const { contacts } = req.body;
    if (!contacts || !contacts.length) {
      return res.status(400).json({ error: true, message: 'Missing required field: contacts', code: 'INVALID_PARAMS' });
    }
    const numbers = contacts.map(c => typeof c === 'string' ? c : c.phone);
    const result = await checkContactsBridge(sock, numbers);
    res.json({ messages: result, meta: { count: result.length } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CONTACTS_CHECK_FAILED' });
  }
}

export async function getContact(sock, req, res) {
  try {
    const contactId = req.params.id;
    const jid = ensureJid(contactId);
    const contact = await getContactBridge(sock, jid);
    res.json({ messages: [contact], meta: { count: 1 } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'CONTACT_FETCH_FAILED' });
  }
}

export async function blockContact(sock, req, res) {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ error: true, message: 'Missing required field: jid', code: 'INVALID_PARAMS' });
    await blockContactBridge(sock, ensureJid(jid));
    res.json({ sent: true, message: `Blocked ${jid}` });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'BLOCK_FAILED' });
  }
}

export async function unblockContact(sock, req, res) {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ error: true, message: 'Missing required field: jid', code: 'INVALID_PARAMS' });
    await unblockContactBridge(sock, ensureJid(jid));
    res.json({ sent: true, message: `Unblocked ${jid}` });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'UNBLOCK_FAILED' });
  }
}