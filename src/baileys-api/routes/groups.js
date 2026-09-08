import { ensureJid, listChats, getGroupMetadata, updateGroupParticipants, updateGroupSettings, leaveGroup as leaveGroupBridge, getGroupInviteCode, revokeGroupInviteCode } from '../bridge.js';

export async function listGroups(sock, req, res) {
  try {
    const chats = await listChats(sock);
    const groups = chats.filter(c => c.isGroup);
    res.json({ messages: groups, meta: { count: groups.length } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUPS_FETCH_FAILED' });
  }
}

export async function createGroup(sock, req, res) {
  try {
    const { subject, participants } = req.body;
    if (!subject) return res.status(400).json({ error: true, message: 'Missing required field: subject', code: 'INVALID_PARAMS' });

    const participantJids = (participants || []).map(p => ensureJid(typeof p === 'string' ? p : p.phone || p.jid));
    const client = sock._clientRef();
    if (!client) throw new Error('Client not initialized');

    const chat = await client.createGroup(subject, participantJids);
    res.json({
      sent: true,
      group: {
        id: chat.id._serialized.replace('@g.us', '@s.whatsapp.net'),
        subject: subject,
        participants: participantJids.map(jid => ({ jid, admin: null })),
        size: participantJids.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUP_CREATE_FAILED' });
  }
}

export async function getGroup(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    const metadata = await getGroupMetadata(sock, jid);
    res.json({ messages: [metadata], meta: { count: 1 } });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUP_FETCH_FAILED' });
  }
}

export async function updateParticipants(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    const { action, participants } = req.body;

    if (!action || !participants || !participants.length) {
      return res.status(400).json({ error: true, message: 'Missing required fields: action, participants', code: 'INVALID_PARAMS' });
    }

    const participantJids = participants.map(p => ensureJid(typeof p === 'string' ? p : p.phone || p.jid));
    await updateGroupParticipants(sock, jid, participantJids, action);
    res.json({ sent: true, action, participants: participantJids.map(jid => ({ jid, status: 'success' })) });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUP_UPDATE_FAILED' });
  }
}

export async function updateSettings(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    const { restrict, announce, desc } = req.body;

    await updateGroupSettings(sock, jid, { restrict, announce });
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUP_SETTINGS_FAILED' });
  }
}

export async function leaveGroup(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    await leaveGroupBridge(sock, jid);
    res.json({ sent: true, success: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'GROUP_LEAVE_FAILED' });
  }
}

export async function getInviteCode(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    const result = await getGroupInviteCode(sock, jid);
    res.json({ code: result.code });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'INVITE_CODE_FAILED' });
  }
}

export async function revokeInviteCode(sock, req, res) {
  try {
    const groupJid = req.params.id;
    const jid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;
    await revokeGroupInviteCode(sock, jid);
    res.json({ sent: true, success: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'INVITE_REVOKE_FAILED' });
  }
}