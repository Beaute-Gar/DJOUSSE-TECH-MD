const GROQ_KEY = process.env.GROQ_API_KEY || '';

async function groqClassify(text, history = []) {
  if (!GROQ_KEY) return null;
  const recent = history.slice(-6).map(h => `${h.sender || 'inconnu'}: ${h.message || h.text || ''}`).join('\n');
  const prompt =
`Analyse ce message WhatsApp et réponds UNIQUEMENT par ce JSON (pas d'autre texte) :
{
  "intent": "GREETING|QUESTION|TASK|JOKE|THANKS|CASUAL_CONVERSATION|ANNOUNCEMENT|URGENT|CHITCHAT",
  "shouldReply": true/false,
  "replyStyle": "warm|helpful|humorous|professional|neutral|empathetic|enthusiastic",
  "reason": "explication courte de l'intention"
}

RÈGLES DE DÉCISION :
- GREETING (salutations, bonjour, bonsoir, bon week-end) → shouldReply=true, replyStyle=warm
- QUESTION (qui, que, quoi, comment, pourquoi, combien, est-ce que, ?) → shouldReply=true, replyStyle=helpful
- TASK (crée, ajoute, planifie, résume, analyse, rappelle, traduis) → shouldReply=true, replyStyle=helpful
- JOKE (blague, humour, mdr, haha) → shouldReply=true si approprié, replyStyle=humorous
- THANKS (merci, merci beaucoup, thanks) → shouldReply=true, replyStyle=warm
- ANNOUNCEMENT (info, annonce, communiqué, attention) → shouldReply=false (sauf si mentionné)
- URGENT (urgence, vite, help, au secours) → shouldReply=true, replyStyle=empathetic
- CASUAL_CONVERSATION (discussion entre membres) → shouldReply=false
- CHITCHAT (bavardage léger) → shouldReply=false sauf si mentionné explicitement

RÈGLE ABSOLUE : Ne JAMAIS changer de sujet. La réponse doit toujours être en rapport direct avec le message.

Historique récent :
${recent || 'début de conversation'}

Message : "${text}"`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch { return null; }
}

function fastClassify(text) {
  const t = text.toLowerCase().trim();
  if (!t) return { intent: 'CASUAL_CONVERSATION', shouldReply: false, replyStyle: 'neutral', reason: 'message_vide' };

  if (/^(bon(jour|soir)|salut|cc|bsr|coucou|bonne\s+(nuit|soirée|journée|année)|joyeux|bon\s+(week-end|dimanche|anniversaire)|excellent\s+(week-end|dimanche|journée))/i.test(t)) {
    const wish = /(week-end|dimanche|année|anniversaire|fête|journée)/i.test(t);
    return {
      intent: 'GREETING',
      shouldReply: true,
      replyStyle: 'warm',
      reason: wish ? 'souhait_détecté' : 'salutation_détectée',
    };
  }

  if (/(?:merci|merci beaucoup|merci infiniment|thanks|thank you)/i.test(t) && t.length < 40) {
    return { intent: 'THANKS', shouldReply: true, replyStyle: 'warm', reason: 'remerciement' };
  }

  if (/^[\p{Emoji}\s]+$/u.test(t)) {
    return { intent: 'CHITCHAT', shouldReply: false, replyStyle: 'neutral', reason: 'emojis_seulement' };
  }

  if (/(?:qui|que|quoi|comment|pourquoi|quand|où|quel|quelle|combien|est-ce)\s/i.test(t) && /\?/.test(t)) {
    return { intent: 'QUESTION', shouldReply: true, replyStyle: 'helpful', reason: 'question_détectée' };
  }

  if (/(?:combien|taux|conversion|change|en\s+(fcfa|xaf|euro|doll|usd|eur|livre|yen|ngn|naira))/i.test(t) && /\d/.test(t)) {
    return { intent: 'TASK', shouldReply: true, replyStyle: 'helpful', reason: 'conversion_détectée' };
  }

  if (/(?:cr[ée]e|ajoute|planifie|organise|r[ée]sume|analyse|calcule|traduis|rappelle)/i.test(t)) {
    return { intent: 'TASK', shouldReply: true, replyStyle: 'helpful', reason: 'action_détectée' };
  }

  if (/(?:mdr|ptdr|haha|lol|😂|🤣|😭)/i.test(t) && t.length < 20) {
    return { intent: 'JOKE', shouldReply: false, replyStyle: 'humorous', reason: 'rire_sans_valeur' };
  }

  return null;
}

export async function classifyMessage(text, context = {}) {
  const { history = [] } = context;

  const fast = fastClassify(text);
  if (fast) return fast;

  const groq = await groqClassify(text, history);
  if (groq && groq.intent) {
    return {
      intent: groq.intent,
      shouldReply: groq.shouldReply !== false,
      replyStyle: groq.replyStyle || 'neutral',
      reason: groq.reason || 'analyse_groq',
    };
  }

  return { intent: 'CASUAL_CONVERSATION', shouldReply: false, replyStyle: 'neutral', reason: 'fallback' };
}

export function shouldRespond(classification, context = {}) {
  const { isGroup = false, senderIsOwner = false, mentionsBot = false, isReplyToBot = false } = context;

  if (!isGroup) return { should: true, reason: 'prive_toujours_repondre' };
  if (mentionsBot || isReplyToBot) return { should: true, reason: 'mention_directe' };
  if (senderIsOwner) return { should: true, reason: 'proprietaire' };

  if (classification.intent === 'URGENT') return { should: true, reason: 'urgence' };
  if (classification.intent === 'QUESTION') return { should: true, reason: 'question' };
  if (classification.intent === 'TASK') return { should: true, reason: 'tache' };
  if (classification.intent === 'GREETING' && classification.shouldReply) return { should: true, reason: 'salutation' };
  if (classification.intent === 'THANKS') return { should: true, reason: 'remerciement' };

  return { should: classification.shouldReply === true, reason: classification.reason || 'decision_ia' };
}

export default { classifyMessage, shouldRespond };
