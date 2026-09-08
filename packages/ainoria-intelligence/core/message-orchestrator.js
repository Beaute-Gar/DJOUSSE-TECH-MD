import { getContextAwareResponder } from './context-aware-responder.js';
import { getContextAnalyzer } from './context-analyzer.js';
import { getConversationEngine } from './conversation-engine.js';
import { getCmIntent } from '../agents/communication-agent.js';

const responder = getContextAwareResponder();
const analyzer = getContextAnalyzer();
const moteur = getConversationEngine();

let _socialMemory = null;
async function _getSocialMemory() {
  if (_socialMemory) return _socialMemory;
  try { const mod = await import('../features/social-context-memory.js'); _socialMemory = mod; return _socialMemory; } catch { return null; }
}

export async function traiterMessageEntrant(jid, messageEntrant, contexteBrut) {
  const cmIntent = getCmIntent(jid, messageEntrant.sender);
  if (cmIntent) return null;

  const isImage = !!messageEntrant.raw?.message?.imageMessage;
  const isDoc = !!messageEntrant.raw?.message?.documentMessage;
  const hasMedia = isImage || isDoc;

  if (hasMedia && !contexteBrut.isGroup && contexteBrut.sock) {
    try {
      const { processMediaMessage } = await import('../features/vision-integration.js');
      const visionResult = await processMediaMessage(contexteBrut.sock, messageEntrant.raw, jid, false);
      if (visionResult) {
        return { texte: visionResult, delaiFrappeMs: 2000 };
      }
    } catch {}
  }

  responder.trackMessage(jid, messageEntrant.sender, messageEntrant.text);

  const historiqueComplet = moteur.getHistorique(jid);
  const historiqueRecent = historiqueComplet.length > 0 ? historiqueComplet : contexteBrut.messages;

  const contexteAnalyse = responder.analyzeContext(historiqueRecent, messageEntrant);
  const decision = await responder.shouldStaySilent(messageEntrant, {
    ...contexteAnalyse,
    isActiveConversation: contexteAnalyse.isActiveConversation,
  });

  if (decision.silent) return null;

  const historiquePourAnalyse = historiqueRecent.map(m => ({
    sender: m.sender || 'inconnu',
    message: m.text || m.message || '',
  }));
  const analyseContextuelle = await analyzer.analyser(jid, historiquePourAnalyse);

  const texteReponse = await moteur.generateResponse(jid, messageEntrant.text, {
    isGroup: contexteBrut.isGroup,
    groupName: contexteBrut.groupName,
    groupType: contexteBrut.groupType,
    senderName: messageEntrant.sender,
    botEstMentionne: messageEntrant.mentionsBot,
    messageRepondATonMessage: messageEntrant.isReplyToBot,
    analyseContextuelle,
    intent: decision.intent || 'CHITCHAT',
    replyStyle: decision.replyStyle || 'neutral',
  });

  if (!texteReponse) return null;

  _updateSocialMemoryAsync(jid, historiqueRecent);

  return {
    texte: texteReponse,
    delaiFrappeMs: moteur.calculerDelaiFrappe(texteReponse),
  };
}

async function _updateSocialMemoryAsync(jid, history) {
  try {
    const sm = await _getSocialMemory();
    if (sm && history.length >= 4) {
      const lastSummarized = global._lastSocialSummary?.[jid] || 0;
      if (Date.now() - lastSummarized > 600000) {
        if (!global._lastSocialSummary) global._lastSocialSummary = {};
        global._lastSocialSummary[jid] = Date.now();
        sm.summarizeConversation(history, jid);
      }
    }
  } catch {}
}
