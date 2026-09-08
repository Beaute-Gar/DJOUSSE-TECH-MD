const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const PERSONA = {
  nom: 'DJOUSSE TECH',
  engine: 'AINORIA',
  philosophie: 'Think Beyond WhatsApp.',
  centres_interet: ['la tech', 'le foot', 'la musique afrobeat', 'les bons plans du quartier'],
  manies: ['dit souvent "franchement"', 'aime relancer par une question', 'un peu taquin'],
  humeur_de_base: 'plutôt enjoué, curieux, un peu blagueur',
};

let _dynamicPersona = null;
let _smartContext = null;
let _groupProfiles = null;
let _socialMemory = null;
let _responseReviewer = null;

async function _getSmartCtx() {
  if (_smartContext) return _smartContext;
  try { const mod = await import('../features/smart-context.js'); _smartContext = mod; return _smartContext; } catch { return null; }
}
async function _getDynPersona() {
  if (_dynamicPersona) return _dynamicPersona;
  try { const mod = await import('../features/dynamic-persona.js'); _dynamicPersona = mod; return _dynamicPersona; } catch { return null; }
}
async function _getGroupProfiles() {
  if (_groupProfiles) return _groupProfiles;
  try { const mod = await import('../../../src/modules/groups/group-profiles.js'); _groupProfiles = mod; return _groupProfiles; } catch { return null; }
}
async function _getSocialMemory() {
  if (_socialMemory) return _socialMemory;
  try { const mod = await import('../features/social-context-memory.js'); _socialMemory = mod; return _socialMemory; } catch { return null; }
}
async function _getResponseReviewer() {
  if (_responseReviewer) return _responseReviewer;
  try { const mod = await import('../features/response-reviewer.js'); _responseReviewer = mod; return _responseReviewer; } catch { return null; }
}

const HUMEURS_DU_JOUR = ['motivé', 'un peu fatigué mais de bonne humeur', 'très bavard', 'calme et posé', 'électrique'];

function getHumeurDuJour() {
  const jour = new Date().toISOString().slice(0, 10);
  const index = [...jour].reduce((acc, c) => acc + c.charCodeAt(0), 0) % HUMEURS_DU_JOUR.length;
  return HUMEURS_DU_JOUR[index];
}

export class ConversationEngine {
  constructor() {
    this.conversationHistory = new Map();
    this.dernieresReponsesBot = new Map();
    this.MAX_HISTORY = 30;
    this.MAX_DERNIERES_REPONSES = 5;
  }

  doitRepondre(message, context) {
    const { isGroup, botMentionne = false, reponseAuBot = false, botEstMentionne, messageRepondATonMessage } = context;
    const mentionne = botEstMentionne || botMentionne;
    const repondAuBot = messageRepondATonMessage || reponseAuBot;

    if (!isGroup) return true;
    if (mentionne || repondAuBot) return true;

    const t = message.trim().toLowerCase();
    const salutations = /^(bon(jour|soir)|salut|cc|bsr|bonne\s+(nuit|soirée|journée)|coucou|hello|hey)\b/i;
    if (salutations.test(t) && t.length < 25) return false;

    if (/(?:merci|merci beaucoup|merci infiniment|thanks)/i.test(t) && t.length < 25) return false;

    if (/^[\p{Emoji}\s]+$/u.test(t)) return false;

    if (/^(bon|excellent|joyeux)\s+(week-end|dimanche|journée|année|anniversaire)/i.test(t)) return false;

    return Math.random() < 0.10;
  }

  async generateResponse(jid, message, contexte = {}) {
    const {
      isGroup = false, groupName = '', groupType = 'general', senderName = 'Inconnu',
      botMentionne = false, reponseAuBot = false, skipDecision = false,
      botEstMentionne, messageRepondATonMessage, analyseContextuelle = null,
      intent = 'CHITCHAT', replyStyle = 'neutral',
    } = contexte;

    this.sauvegarder(jid, senderName, message);

    const mentionne = botEstMentionne || botMentionne;
    const repondAuBot = messageRepondATonMessage || reponseAuBot;

    if (!skipDecision && !this.doitRepondre(message, { isGroup, mentionne, repondAuBot })) {
      return null;
    }

    const history = this.getHistorique(jid);
    const dernieresReponses = this.getDernieresReponses(jid);
    const humeurDuJour = getHumeurDuJour();

    let personaText = '';
    let persona = 'normal';
    let flirtTarget = null;
    const dyn = await _getDynPersona();
    const sc = await _getSmartCtx();
    if (dyn && sc) {
      persona = dyn.getCurrentPersona(jid);
      flirtTarget = dyn.getFlirtTarget(jid);
      const personaPrompt = sc.getPersonaPrompt(persona, flirtTarget || senderName);
      if (personaPrompt) personaText = `\nSTYLE ACTUEL :\n${personaPrompt}`;
    }
    const loc = sc ? await sc.getAutoLocation(jid) : null;

    if (sc && /quelle\s+heure|il\s+est\s+\d+|donne\s+moi\s+l'heure/i.test(message)) {
      return sc.formatTimeComedy(loc || { ville: 'Douala', pays: 'Cameroun', fuseau: 'Africa/Douala' });
    }

    let proposalReply = null;
    if (sc && isGroup && !mentionne && !repondAuBot) {
      const unanswered = sc.detectUnansweredProposals(history, PERSONA.nom);
      if (unanswered) {
        const proposalText = `${unanswered.sender} a proposé : "${unanswered.message}". Personne n'a répondu.`;
        const proposalPrompt = `Tu es ${PERSONA.nom}. Dans ce groupe WhatsApp, ${proposalText} Réponds à cette proposition comme si tu venais juste de la voir. Sois naturel et engageant, max 2-3 phrases.`;
        proposalReply = await this.appelerGroq(proposalPrompt, proposalText, history);
        if (proposalReply && proposalReply.length > 3) {
          this.sauvegarder(jid, PERSONA.nom, proposalReply);
          this.addDerniereReponse(jid, proposalReply);
          return await this._applyReview(proposalReply, contexte);
        }
      }
    }

    const recentMessages = history.slice(-10).map(h => `${h.sender}: ${h.message}`).join('\n');

    const profiles = await _getGroupProfiles();
    let profile = null;
    if (profiles && isGroup) {
      profile = profiles.detectGroupProfile(groupName);
    }

    const profileTone = profile?.persona?.tone || '';
    const profileRole = profile?.persona?.role || '';
    const effectiveStyle = profile?.persona?.replyStyle || replyStyle;

    const sm = await _getSocialMemory();
    let groupCulture = null;
    if (sm) {
      try {
        const mem = await sm.getGroupCulture(jid, groupName, groupType);
        if (mem) groupCulture = mem;
      } catch {}
    }

    const styleGuide = {
      warm: 'Sois chaleureux, poli, et bienveillant. Réponds avec gentillesse.',
      helpful: 'Sois utile, précis, et direct. Donne l\'information demandée clairement.',
      humorous: 'Sois drôle et léger. Une petite blague ou un ton taquin est approprié.',
      professional: 'Sois formel, courtois, et professionnel. Langage soigné.',
      empathetic: 'Sois compatissant et rassurant. Montre que tu comprends.',
      enthusiastic: 'Sois énergique et positif. Montre de l\'enthousiasme.',
      neutral: 'Sois naturel et décontracté.',
      pedagogue_chaleureux: 'Sois un enseignant bienveillant. Encourage et valorise les efforts.',
      camarade_expert: 'Sois un camarade brillant et complice. Explique simplement.',
      animateur_festif: 'Sois enthousiaste, fun et créatif. Garde l\'énergie positive.',
      conteur_curieux: 'Sois un conteur passionné. Pose des questions qui font réfléchir.',
      gamer_expert: 'Parle comme un joueur expert. Conseils techniques, références gaming.',
      otaku_passionné: 'Sois un otaku passionné. Références anime, mots japonais, enthousiasme.',
      ami_chaleureux: 'Sois un ami proche et attentionné. Chaleureux et à l\'écoute.',
    };
    const styleInstruction = styleGuide[effectiveStyle] || styleGuide.neutral;

    let groupCultureText = '';
    if (groupCulture && groupCulture.topics?.length > 0) {
      groupCultureText = `\nMÉMOIRE DU GROUPE :
- Thèmes récurrents : ${groupCulture.topics.join(', ')}
- Ambiance habituelle : ${groupCulture.mood}
- Conversations enregistrées : ${groupCulture.conversationsCount}`;
    }

    let profileText = '';
    if (profileTone) {
      profileText = `\nTON SPÉCIFIQUE POUR CE GROUPE :
${profileTone}`;
    }

    const prompt = `Tu es ${PERSONA.nom} — ${PERSONA.philosophie}

Tu es un compagnon d'intelligence personnelle qui discute sur WhatsApp. Tu n'es pas un bot. Tu es un assistant intelligent, conçu pour comprendre, organiser et aider.

PERSONNALITÉ :
- Poli, chaleureux, professionnel, humble et utile.
- Tu ne changes JAMAIS de sujet. Tu réponds toujours en rapport direct avec le message.
- Tu ne cherches jamais à attirer l'attention.
- Tu participes comme un membre respectueux du groupe.
- Tu tutoies et utilises un langage naturel.
- Tu ne te présentes jamais comme un "bot" ou une "IA" sauf si on te le demande directement.
${profileRole ? `- Ton rôle : ${profileRole}.` : ''}
${personaText}
${profileText}

STYLE DE RÉPONSE : ${styleInstruction}

CONTEXTE :
${isGroup ? `Groupe "${groupName}" (thème: ${groupType}).` : `Discussion privée avec ${senderName}.`}
${loc ? `Localisation : ${loc.ville}, ${loc.pays}` : ''}
${mentionne ? 'On t\'a directement mentionné.' : ''}
${repondAuBot ? 'Cette personne répond à un de tes messages.' : ''}
${flirtTarget ? `Tu as une attention particulière pour ${flirtTarget}.` : ''}
${groupCultureText}

Historique récent :
${recentMessages || 'Début de conversation'}

${analyseContextuelle ? `ANALYSE :
- Sujet : ${analyseContextuelle.sujet_principal}
- Ambiance : ${analyseContextuelle.ambiance}
${analyseContextuelle.points_cles?.length ? `- Points clés : ${analyseContextuelle.points_cles.join(' / ')}` : ''}` : ''}

${dernieresReponses.length ? `Déjà dit :\n${dernieresReponses.map(r => `"${r}"`).join('\n')}\nNe répète pas.` : ''}

Message de ${senderName} : "${message}"

RÈGLE ABSOLUE : Réponds UNIQUEMENT en rapport avec ce message. Ne change pas de sujet. Max 2-3 phrases.`;

    try {
      const reponse = await this.appelerGroq(prompt, message, history);
      if (reponse && reponse.length > 3) {
        this.sauvegarder(jid, PERSONA.nom, reponse);
        this.addDerniereReponse(jid, reponse);
        return await this._applyReview(reponse, contexte);
      }
    } catch {
      return this.fallbackAdapte(message);
    }

    return this.fallbackAdapte(message);
  }

  async _applyReview(response, contexte) {
    const reviewer = await _getResponseReviewer();
    if (!reviewer) return response;

    const { message, groupName, groupType, intent, replyStyle, isGroup } = contexte;
    const result = await reviewer.reviewResponse(response, {
      message, groupName, groupType, intent, replyStyle, isGroup,
    });

    if (!result.approved) return null;
    return result.response;
  }

  async appelerGroq(systemPrompt, userMessage, history) {
    if (!GROQ_API_KEY) return null;

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const h of history.slice(-10)) {
      messages.push(
        h.sender === PERSONA.nom
          ? { role: 'assistant', content: h.message }
          : { role: 'user', content: `${h.sender}: ${h.message}` }
      );
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.95,
        max_tokens: 200,
        top_p: 0.95,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  }

  fallbackAdapte(message) {
    const fallbacks = [
      "Dites, c'est quoi votre plus grand rêve en ce moment ?",
      "Question du jour : montagne ou plage pour les vacances ?",
      "Si vous gagniez un million demain, vous feriez quoi en premier ?",
      "Quel est le dernier film que vous avez regardé ?",
      "Plutôt café ou thé le matin ?",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  getHistorique(jid) {
    if (!this.conversationHistory.has(jid)) this.conversationHistory.set(jid, []);
    return this.conversationHistory.get(jid);
  }

  sauvegarder(jid, sender, message) {
    const history = this.getHistorique(jid);
    history.push({ sender, message, timestamp: Date.now() });
    if (history.length > this.MAX_HISTORY) history.splice(0, history.length - this.MAX_HISTORY);
  }

  getDernieresReponses(jid) {
    const liste = this.dernieresReponsesBot.get(jid) || [];
    return liste.length > 0 ? liste : [];
  }

  addDerniereReponse(jid, reponse) {
    if (!this.dernieresReponsesBot.has(jid)) this.dernieresReponsesBot.set(jid, []);
    const liste = this.dernieresReponsesBot.get(jid);
    liste.push(reponse);
    if (liste.length > this.MAX_DERNIERES_REPONSES) liste.shift();
  }

  effacerMemoire(jid) {
    this.conversationHistory.delete(jid);
    this.dernieresReponsesBot.delete(jid);
  }

  calculerDelaiFrappe(texteReponse) {
    const motsParMinute = 180 + Math.random() * 60;
    const nbMots = texteReponse.split(' ').length;
    const delaiMs = (nbMots / motsParMinute) * 60 * 1000;
    return Math.min(Math.max(delaiMs, 800), 6000);
  }

  simulerFrappe(sock, jid) {
    const delai = 500 + Math.random() * 1500;
    return new Promise(r => setTimeout(r, delai));
  }
}

let instance = null;
export function getConversationEngine() {
  if (!instance) instance = new ConversationEngine();
  return instance;
}
