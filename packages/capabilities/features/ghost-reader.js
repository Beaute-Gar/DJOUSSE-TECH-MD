import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('GHOST');

const state = { enabled: false, read: new Set() };

export function setGhost(v) { state.enabled = v; log.info(`Mode fantôme: ${v ? 'ON' : 'OFF'}`); return v; }
export function isGhost() { return state.enabled; }

export async function readWithoutTick(sock, jid) {
  try {
    const msgs = sock.store?.messages?.[jid]?.array || [];
    const unread = msgs.filter(m => !m.key?.fromMe && !state.read.has(m.key?.id));
    for (const m of unread) state.read.add(m.key?.id);
    const previews = unread.slice(-5).map(m => ({
      sender: m.key?.participant?.split('@')[0] || '?',
      text: (m.message?.conversation || m.message?.extendedTextMessage?.text || '[Média]').slice(0, 100),
    }));
    return { total: msgs.length, new: unread.length, previews };
  } catch { return { total: 0, new: 0, previews: [] }; }
}
