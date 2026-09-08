const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const INTERVALLE_MIN_MS = 45000;

const PATTERNS_RIRE = /(mdr|ptdr|lol|haha|hihi|😂|🤣|jure|t'es (sérieux|grave))/i;
const PATTERNS_DESACCORD = /(non mais|n'importe quoi|pas d'accord|je pense pas|faux)/i;
const PATTERNS_DECISION = /(on fait comme ça|c'est décidé|ok on part sur|validé|adopté)/i;

export class ContextAnalyzer {
  constructor() {
    this.cache = new Map();
  }

  async analyser(jid, historique) {
    const messagesRecents = historique.slice(-12);
    const heuristique = this.analyseHeuristique(messagesRecents);
    const cacheActuel = this.cache.get(jid);

    const cacheEncoreValide = cacheActuel
      && (Date.now() - cacheActuel.timestamp) < INTERVALLE_MIN_MS
      && !heuristique.changementSujetProbable;

    if (cacheEncoreValide) {
      return { ...cacheActuel, ...heuristique };
    }

    const resumeIA = await this.resumerViaIA(messagesRecents, heuristique);
    const resultat = { ...heuristique, ...resumeIA, timestamp: Date.now() };
    this.cache.set(jid, resultat);
    return resultat;
  }

  analyseHeuristique(messages) {
    if (messages.length === 0) {
      return { nbParticipantsActifs: 0, ambiance: 'neutre', changementSujetProbable: false };
    }

    const texteComplet = messages.map(m => m.message).join(' ');
    const nbRires = (texteComplet.match(PATTERNS_RIRE) || []).length;
    const desaccordDetecte = PATTERNS_DESACCORD.test(texteComplet);
    const decisionDetectee = PATTERNS_DECISION.test(texteComplet);
    const participants = new Set(messages.map(m => m.sender));
    const changementSujetProbable = this.detecterChangementSujet(messages);

    let ambiance = 'neutre';
    if (nbRires >= 2) ambiance = 'légère, on rigole';
    else if (desaccordDetecte) ambiance = 'tendue, désaccord en cours';
    else if (decisionDetectee) ambiance = 'on vient de trancher';

    return { nbParticipantsActifs: participants.size, ambiance, changementSujetProbable };
  }

  detecterChangementSujet(messages) {
    if (messages.length < 6) return false;
    const motsRecents = this.extraireMotsClefs(messages.slice(-3));
    const motsAvant = this.extraireMotsClefs(messages.slice(-6, -3));
    const intersection = [...motsRecents].filter(m => motsAvant.has(m));
    return intersection.length <= 1 && motsAvant.size > 0;
  }

  extraireMotsClefs(messages) {
    const motsVides = new Set(['le','la','les','de','des','un','une','et','est','que','qui','pas','tu','je','on','à','ça','ce','il','elle','nous','vous','ils','elles','me','te','se','lui','leur','mais','ou','donc','car','ni','or']);
    const mots = messages
      .flatMap(m => (m.message || '').toLowerCase().split(/\W+/))
      .filter(m => m.length > 3 && !motsVides.has(m));
    return new Set(mots);
  }

  async resumerViaIA(messages, heuristique) {
    if (!GROQ_API_KEY || messages.length === 0) {
      return { sujet_principal: 'conversation en cours', points_cles: [] };
    }

    const transcript = messages.map(m => `${m.sender}: ${m.message}`).join('\n');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [{
            role: 'system',
            content: `Voici les derniers messages d'une conversation WhatsApp :

${transcript}

Réponds UNIQUEMENT avec un JSON, sans texte autour :
{
  "sujet_principal": "résumé du sujet actuel en 5-8 mots",
  "points_cles": ["2-3 informations importantes à retenir"]
}`
          }],
          temperature: 0.3,
          max_tokens: 150,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'context_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  sujet_principal: { type: 'string' },
                  points_cles: { type: 'array', items: { type: 'string' } },
                },
                required: ['sujet_principal', 'points_cles'],
              },
            },
          },
        }),
      });

      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content.trim());
      return {
        sujet_principal: parsed.sujet_principal || 'conversation en cours',
        points_cles: Array.isArray(parsed.points_cles) ? parsed.points_cles : [],
      };
    } catch {
      return { sujet_principal: 'conversation en cours', points_cles: [] };
    }
  }

  invaliderCache(jid) {
    this.cache.delete(jid);
  }
}

let instance = null;
export function getContextAnalyzer() {
  if (!instance) instance = new ContextAnalyzer();
  return instance;
}
