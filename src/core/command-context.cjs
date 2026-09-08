/* CommandContext — troisième argument enrichi fourni aux plugins (4e arg du dispatch)
   et utilisé par le code neuf : ctx.chat, ctx.message, ctx.wa, ctx.execute(ACTION).
   Additif : aucun plugin existant n'est modifié, le 4e arg garde {reply, q, ...}. */

const { getWhatsAppAdapter } = require('../whatsapp/whatsapp-adapter.cjs');
const { normalizeMessage, getQuoted } = require('./message-normalizer.cjs');
const { executeAction } = require('./action-executor.cjs');

function buildContext(conn, m, commands, base) {
  try {
    const wa = getWhatsAppAdapter(conn);
    const norm = normalizeMessage(m);
    const baseObj = base && typeof base === 'object' ? base : {};
    const chatId = norm.chatId || baseObj.from || null;
    const isOwner = !!(baseObj.isOwner);

    const ctx = {
      ...baseObj,
      conn,
      commands,
      client: baseObj.client || conn,
      message: norm,
      chat: {
        id: chatId,
        isGroup: norm.isGroup,
      },
      sender: {
        id: norm.senderId,
        isGroup: norm.isGroup,
      },
      command: norm.body ? String(norm.body).trim().split(/\s+/)[0] : null,
      isGroup: norm.isGroup,
      isOwner,
      q: baseObj.q || '',
      args: baseObj.args || [],
      from: chatId,
      wa,
      reply: async (text, opts) => {
        try {
          if (m && typeof m.reply === 'function') return m.reply(text);
          return wa.sendText(chatId, text, opts);
        } catch (e) {
          return wa.sendText(chatId, text, opts);
        }
      },
      send: async (jid, text, opts) => wa.sendText(jid, text, opts),
      edit: async (key, text) => wa.edit(chatId, key, text),
      delete: async (key) => wa.delete(chatId, key),
      react: async (emoji) => (norm.key ? wa.react(chatId, emoji, norm.key) : null),
      getQuoted: () => getQuoted(m),
      getMedia: async (msgLike, filename) => wa.getMedia(msgLike || getQuoted(m), filename),
      execute: async (action, extra) => executeAction(action, { ...(extra || {}), conn, m, wa }),
    };

    return ctx;
  } catch (e) {
    const c = {
      ...(base && typeof base === 'object' ? base : {}),
      conn,
      commands,
      message: normalizeMessage(m),
      chat: { id: (m && m.chat) || null, isGroup: !!(m && m.isGroup) },
      sender: { id: (m && m.sender) || null, isGroup: !!(m && m.isGroup) },
      wa: getWhatsAppAdapter(conn),
      reply: (t) => (m && typeof m.reply === 'function' ? m.reply(t) : Promise.resolve()),
      send: (jid, t) => Promise.resolve(),
      execute: () => Promise.reject(e),
    };
    return c;
  }
}

module.exports = { buildContext };