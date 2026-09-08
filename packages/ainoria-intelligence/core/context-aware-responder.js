import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('CTX:RESPONDER');

const _classifierCache = {};

export class ContextAwareResponder {
  constructor() {
    this.activeConversations = new Map();
    this.TIMEOUT_MS = 180000;
    this.MIN_MESSAGE_LENGTH = 3;
    this.conversationTracker = new Map();
  }

  async _getClassifier() {
    if (_classifierCache.module) return _classifierCache.module;
    try {
      const mod = await import('../features/message-classifier.js');
      _classifierCache.module = mod;
      return mod;
    } catch { return null; }
  }

  analyzeContext(messages, currentMessage) {
    if (!messages || messages.length < 2) {
      return { isActiveConversation: false, recentMessages: 0, silenceDuration: 0 };
    }
    const recent = messages.slice(-10);
    const now = Date.now();
    const ts = (m) => m.timestamp || m.time || now;
    const lastMsg = recent[recent.length - 1];
    const silenceDuration = lastMsg ? now - ts(lastMsg) : 0;
    return {
      isActiveConversation: recent.some(m => (now - ts(m)) < this.TIMEOUT_MS),
      recentMessages: recent.length,
      silenceDuration,
    };
  }

  trackMessage(jid, senderJid, text) {
    if (!this.conversationTracker.has(jid)) {
      this.conversationTracker.set(jid, []);
    }
    const history = this.conversationTracker.get(jid);
    history.push({ sender: senderJid, text, time: Date.now() });
    if (history.length > 50) history.splice(0, history.length - 50);
  }

  async shouldStaySilent(message, context) {
    if (!message || !message.text) return { silent: true, reason: 'message_vide' };

    const text = message.text.trim();
    if (text.length < this.MIN_MESSAGE_LENGTH && !message.isReplyToBot && !message.mentionsBot) {
      return { silent: true, reason: 'trop_court' };
    }

    if (message.type === 'audio' || message.type === 'voice') {
      return { silent: true, reason: 'message_vocal' };
    }

    if (message.isReply && !message.isReplyToBot && !message.mentionsBot) {
      return { silent: true, reason: 'repond_a_quelqu_un_dautre' };
    }

    if (context.isActiveConversation && !message.mentionsBot && !message.isReplyToBot) {
      return { silent: true, reason: 'conversation_active_entre_humains' };
    }

    if (message.isGroup && context.isActiveConversation && !message.mentionsBot) {
      return { silent: true, reason: 'echange_de_groupe_en_cours' };
    }

    if (text.length > 500 && !message.mentionsBot && !message.isReplyToBot) {
      return { silent: true, reason: 'message_trop_long_non_sollicite' };
    }

    const classifier = await this._getClassifier();
    if (classifier) {
      const history = this.conversationTracker.get(message.jid) || [];
      const result = await classifier.classifyMessage(text, {
        isReplyToBot: message.isReplyToBot,
        mentionsBot: message.mentionsBot,
        senderIsOwner: message.senderIsOwner || false,
        history,
      });
      const decision = classifier.shouldRespond(result, {
        isGroup: message.isGroup,
        senderIsOwner: message.senderIsOwner || false,
        mentionsBot: message.mentionsBot,
        isReplyToBot: message.isReplyToBot,
      });
      if (!decision.should) {
        return { silent: true, reason: decision.reason };
      }
      return { silent: false, reason: decision.reason, intent: result.intent, replyStyle: result.replyStyle };
    }

    return { silent: false, reason: 'peut_repondre' };
  }
}

let _instance = null;
export function getContextAwareResponder() {
  if (!_instance) _instance = new ContextAwareResponder();
  return _instance;
}
