const GROQ_KEY = process.env.GROQ_API_KEY || '';

const STYLE_RULES = {
  warm: 'Chaleureux et bienveillant. Ne sois pas trop formel.',
  helpful: 'Utile et précis. Va droit au but.',
  humorous: 'Léger et drôle. Ne force pas l\'humour.',
  professional: 'Courtois et soigné. Langage correct.',
  empathetic: 'Compatissant et rassurant. Montre que tu comprends.',
  enthusiastic: 'Énergique et positif.',
  neutral: 'Naturel et décontracté.',
  pedagogue_chaleureux: 'Pédagogue bienveillant comme un enseignant.',
  camarade_expert: 'Camarade de classe brillant et complice.',
};

export async function reviewResponse(response, context = {}) {
  const {
    message, groupType = 'general', replyStyle = 'neutral',
    intent = 'CHITCHAT', isGroup = false, groupName = '',
  } = context;

  if (!response || response.length < 3) {
    return { approved: false, reason: 'reponse_trop_courte', response: null };
  }

  if (!GROQ_KEY) return { approved: true, response };

  const styleRule = STYLE_RULES[replyStyle] || STYLE_RULES.neutral;

  const prompt = `Tu vérifies la qualité d'une réponse WhatsApp avant envoi.

CONTEXTE :
- Groupe : ${groupName || 'privé'} (type: ${groupType})
- Intention détectée : ${intent}
- Style attendu : ${styleRule}
- Message reçu : "${message || '(aucun)'}"

RÉPONSE À VÉRIFIER : "${response}"

RÈGLES DE VÉRIFICATION :
1. La réponse reste-t-elle dans le SUJET du message ? (ne change pas de sujet)
2. La réponse est-elle UTILE ou APPROPRIÉE pour ce contexte ?
3. Le ton correspond-il au style attendu ?
4. La réponse est-elle naturelle (pas robotique) ?
5. Est-ce que la réponse apporte une VALEUR AJOUTÉE ?
6. La réponse ne répète-t-elle PAS quelque chose déjà dit récemment ?

Réponds UNIQUEMENT par ce JSON (pas d'autre texte) :
{
  "approved": true/false,
  "reason": "courte explication si refusé, ou 'ok' si approuvé",
  "modified": "la réponse améliorée si besoin, ou identique si approuvée telle quelle"
}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { approved: true, response };
    const data = await res.json();
    const content = JSON.parse(data?.choices?.[0]?.message?.content || '{}');

    if (content.approved === false) {
      return { approved: false, reason: content.reason || 'refusé', response: null };
    }

    const finalResponse = (content.modified && content.modified !== response) ? content.modified : response;
    return { approved: true, response: finalResponse };
  } catch {
    return { approved: true, response };
  }
}

export default { reviewResponse };
