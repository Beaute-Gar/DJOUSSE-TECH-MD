/* WhatsAppAdapter — API interne du bot, frontale unique vers le moteur.
   Vrai moteur actuel : whatsapp-web.js via le socket Baileys-compatible (sock).
   Aucun plugin n'est modifié : cette façade est utilisée par le code NEUF
   (CommandContext, Action Executor, SCG) et sert de cible de migration. */

let jidToWid;
try {
  jidToWid = require('../engine/wwebjs-adapter.cjs').jidToWid;
} catch (e) {
  jidToWid = (jid) => {
    const j = String(jid || '').split(':')[0];
    if (j.endsWith('@s.whatsapp.net')) return j.slice(0, -'@s.whatsapp.net'.length) + '@c.us';
    return j;
  };
}
const { normalizeGroup } = require('../core/message-normalizer.cjs');

const CAPABILITIES = {
  sendText: true,
  sendImage: true,
  sendVideo: true,
  sendAudio: true,
  sendSticker: true,
  sendDocument: true,
  sendPoll: true,
  sendStatus: true,
  reply: true,
  quotedMessage: true,
  media: true,
  editMessage: true,
  deleteMessage: true,
  react: true,
  groups: true,
  participants: true,
  groupCreate: true,
  groupInvite: true,
  promote: true,
  demote: true,
  removeParticipant: true,
  addParticipant: true,
  presence: true,
  readChat: true,
  calls: false,
  pairingCode: false,
  payments: false,
  productCatalog: false,
  twoFactor: false,
};

class WhatsAppAdapter {
  constructor(conn) {
    this.conn = conn || null;
    this.capabilities = { ...CAPABILITIES };
  }

  supports(cap) {
    return !!this.capabilities[cap];
  }

  _jid(jid) {
    if (jid) return jid;
    throw new Error('[ADAPTER] jid (chatId) manquant');
  }

  _check(cap) {
    if (!this.supports(cap)) {
      throw new Error(`[ADAPTER] Capacité "${cap}" non disponible avec le moteur actuel`);
    }
    return true;
  }

  /* ── Texte / réactions ── */
  async sendText(jid, text, options = {}) {
    this._check('sendText');
    return this.conn.sendMessage(this._jid(jid), { text: String(text), ...options.contextInfo ? { contextInfo: options.contextInfo } : {} }, options);
  }

  async reply(jid, text, quoted, options = {}) {
    this._check('reply');
    return this.conn.sendMessage(this._jid(jid), { text: String(text) }, { ...options, quoted: quoted || undefined });
  }

  async edit(jid, key, text) {
    this._check('editMessage');
    const k = typeof key === 'object' ? key : { id: String(key) };
    return this.conn.sendMessage(this._jid(jid), { text: String(text), edit: k });
  }

  async delete(jid, key, forEveryone = true) {
    this._check('deleteMessage');
    const id = typeof key === 'object' ? key.id : String(key);
    return this.conn.sendMessage(this._jid(jid), { delete: { id, forEveryone } });
  }

  async react(jid, emoji, key) {
    this._check('react');
    return this.conn.sendMessage(this._jid(jid), { react: { text: String(emoji), key } });
  }

  async sendStatus(text) {
    this._check('sendStatus');
    return this.conn.sendMessage('status@broadcast', { text: String(text) });
  }

  /* ── Médias ── */
  async sendImage(jid, buffer, options = {}) {
    this._check('sendImage');
    return this.conn.sendMessage(this._jid(jid), {
      image: buffer,
      caption: options.caption,
      mimetype: options.mimetype || 'image/jpeg',
      imageName: options.fileName || 'image.jpg',
      contextInfo: options.contextInfo,
    }, options);
  }

  async sendVideo(jid, buffer, options = {}) {
    this._check('sendVideo');
    return this.conn.sendMessage(this._jid(jid), {
      video: buffer,
      caption: options.caption,
      mimetype: options.mimetype || 'video/mp4',
      videoName: options.fileName || 'video.mp4',
      gifPlayback: options.gifPlayback,
      contextInfo: options.contextInfo,
    }, options);
  }

  async sendAudio(jid, buffer, options = {}) {
    this._check('sendAudio');
    return this.conn.sendMessage(this._jid(jid), {
      audio: buffer,
      mimetype: options.mimetype || 'audio/mpeg',
      ptt: options.ptt,
      contextInfo: options.contextInfo,
    }, options);
  }

  async sendSticker(jid, buffer, options = {}) {
    this._check('sendSticker');
    return this.conn.sendMessage(this._jid(jid), {
      sticker: buffer,
      mimetype: options.mimetype || 'image/webp',
      contextInfo: options.contextInfo,
    }, options);
  }

  async sendDocument(jid, buffer, options = {}) {
    this._check('sendDocument');
    return this.conn.sendMessage(this._jid(jid), {
      document: buffer,
      mimetype: options.mimetype || 'application/pdf',
      fileName: options.fileName || 'document.pdf',
      caption: options.caption,
      contextInfo: options.contextInfo,
    }, options);
  }

  async sendPoll(jid, question, optionsList, opts = {}) {
    this._check('sendPoll');
    const optsArr = Array.isArray(optionsList) ? optionsList.map(o => typeof o === 'string' ? { optionName: o } : o) : [];
    return this.conn.sendMessage(this._jid(jid), {
      pollCreationMessage: {
        name: String(question),
        options: optsArr,
        selectableOptionsCount: opts.selectableCount || optsArr.length,
      },
    }, opts);
  }

  /* ── Chats / contacts / groupes ── */
  async getChat(jid) {
    const j = this._jid(jid);
    if (/@g\.us$/.test(j)) {
      try {
        const g = await this.conn.groupMetadata(j);
        return normalizeGroup(g);
      } catch (e) {
        return null;
      }
    }
    try {
      const c = this._client();
      if (c && typeof c.getChatById === 'function') {
        const ch = await c.getChatById(jidToWid(j));
        return { id: j, isGroup: false, name: ch.name || '', unreadCount: ch.unreadCount || 0 };
      }
    } catch (e) {}
    return { id: j, isGroup: false, name: '' };
  }

  async getContact(jid) {
    const j = this._jid(jid);
    try {
      const c = this._client();
      if (c && typeof c.getContactById === 'function') {
        const ct = await c.getContactById(jidToWid(j));
        return {
          id: j,
          number: ct.number || String(j).split('@')[0],
          name: ct.name,
          pushName: ct.pushname,
          isMe: !!ct.isMe,
        };
      }
    } catch (e) {}
    return { id: j, number: String(j).split('@')[0], name: '', pushName: '' };
  }

  async getGroup(jid) {
    this._check('groups');
    try {
      const g = await this.conn.groupMetadata(this._jid(jid));
      return normalizeGroup(g);
    } catch (e) {
      return null;
    }
  }

  async getParticipants(jid) {
    const g = await this.getGroup(jid);
    return g ? g.participantIds : [];
  }

  async getGroupAdmins(jid) {
    const g = await this.getGroup(jid);
    return g ? g.adminJids : [];
  }

  /* ── Citation / média ── */
  getQuoted(m) {
    return (m && m.quoted) ? m.quoted : null;
  }

  async getMedia(msgLike, filename) {
    this._check('media');
    return this.conn.downloadMediaMessage(msgLike, filename);
  }

  async loadHistory(jid, limit = 25) {
    return this.conn.loadMessages(this._jid(jid), limit);
  }

  /* ── Gestion de groupe ── */
  async groupAdd(jid, participantIds) {
    this._check('addParticipant');
    return this.conn.groupParticipantsUpdate(this._jid(jid), participantIds, 'add');
  }

  async groupKick(jid, participantIds) {
    this._check('removeParticipant');
    return this.conn.groupParticipantsUpdate(this._jid(jid), participantIds, 'remove');
  }

  async groupPromote(jid, participantIds) {
    this._check('promote');
    return this.conn.groupParticipantsUpdate(this._jid(jid), participantIds, 'promote');
  }

  async groupDemote(jid, participantIds) {
    this._check('demote');
    return this.conn.groupParticipantsUpdate(this._jid(jid), participantIds, 'demote');
  }

  async groupSubject(jid, subject) {
    return this.conn.groupUpdateSubject(this._jid(jid), String(subject));
  }

  async groupDescription(jid, desc) {
    return this.conn.groupUpdateDescription(this._jid(jid), String(desc));
  }

  async groupCreate(subject, participants = []) {
    this._check('groupCreate');
    return this.conn.groupCreate(String(subject), participants);
  }

  async groupInviteCode(jid) {
    this._check('groupInvite');
    return this.conn.groupInviteCode(this._jid(jid));
  }

  async groupEditSubject(jid, subject) {
    return this.groupSubject(jid, subject);
  }

  /* ── Présence / lecture ── */
  async sendPresence(presence, jid) {
    this._check('presence');
    return this.conn.sendPresenceUpdate(presence || 'available', jid);
  }

  async readChat(jid) {
    this._check('readChat');
    return this.conn.readMessages([{ remoteJid: this._jid(jid) }]);
  }

  _client() {
    try {
      return (this.conn && typeof this.conn._clientRef === 'function') ? this.conn._clientRef() : null;
    } catch (e) {
      return null;
    }
  }

  static create(conn) {
    return new WhatsAppAdapter(conn);
  }
}

function getWhatsAppAdapter(conn) {
  if (conn && conn._whatsAppAdapter instanceof WhatsAppAdapter) return conn._whatsAppAdapter;
  const adapter = new WhatsAppAdapter(conn);
  if (conn) {
    try { conn._whatsAppAdapter = adapter; } catch (e) {}
  }
  return adapter;
}

module.exports = { WhatsAppAdapter, getWhatsAppAdapter, CAPABILITIES };