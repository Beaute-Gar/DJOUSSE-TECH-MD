import { updateMyPresence as updateMyPresenceBridge, updatePresence as updatePresenceBridge } from '../bridge.js';

export async function updateMyPresence(sock, req, res) {
  try {
    const { presence } = req.body;
    if (!presence) return res.status(400).json({ error: true, message: 'Missing required field: presence', code: 'INVALID_PARAMS' });

    const validPresences = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    if (!validPresences.includes(presence)) {
      return res.status(400).json({
        error: true,
        message: `Invalid presence: ${presence}. Valid: ${validPresences.join(', ')}`,
        code: 'INVALID_PARAMS',
      });
    }

    await updateMyPresenceBridge(sock, presence);
    res.json({ sent: true, presence, scope: 'global' });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'PRESENCE_UPDATE_FAILED' });
  }
}

export async function updatePresence(sock, req, res) {
  try {
    const chatId = req.params.id;
    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    const { presence } = req.body;

    if (!presence) return res.status(400).json({ error: true, message: 'Missing required field: presence', code: 'INVALID_PARAMS' });

    const validPresences = ['composing', 'recording', 'paused'];
    if (!validPresences.includes(presence)) {
      return res.status(400).json({
        error: true,
        message: `Invalid presence: ${presence}. Valid: ${validPresences.join(', ')}`,
        code: 'INVALID_PARAMS',
      });
    }

    await updatePresenceBridge(sock, jid, presence);
    res.json({ sent: true, presence, chatId: jid });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'PRESENCE_UPDATE_FAILED' });
  }
}