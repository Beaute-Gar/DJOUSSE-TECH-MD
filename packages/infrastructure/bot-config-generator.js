import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');
import { createLogger } from './logger.js';

const log = createLogger('BOT_CONFIG');

const TYPES_MODULES_CONNUS = ['menu', 'faq', 'horaires', 'jeu', 'personnalise'];
const TONS_VALIDES = ['amical', 'professionnel', 'humoristique', 'strict', 'mystique', 'chaleureux', 'direct'];
const JEUX_DISPONIBLES = ['rpg', 'quiz', 'roulette'];

const CONFIG_PAR_DEFAUT = {
  identite: { nom_bot: 'Mon Bot', avatar_base64: null, slogan: '', langue_principale: 'fr' },
  personnalite: { ton: 'amical', tutoiement: true, emojis: true, niveau_formalite: 3, description_courte: 'Assistant WhatsApp généraliste.', traits: [] },
  domaine_activite: { categorie_principale: 'autre', description_activite: '' },
  modules: [],
  message_bienvenue: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
  mots_cles_declencheurs: ['menu', 'aide'],
  parametres_avances: { reponse_hors_sujet: 'Je ne suis pas sûr de pouvoir t\'aider avec ça.', escalade_humain: false },
};

export async function genererConfigDepuisPrompt(promptUtilisateur) {
  const systemPrompt = `Tu configures un bot WhatsApp universel à partir d'une description libre.
Le bot peut servir à N'IMPORTE QUOI : commerce, service, jeu, éducation, association, usage personnel...

Description de l'utilisateur :
"${promptUtilisateur}"

Réponds UNIQUEMENT avec un JSON valide, structure EXACTE ci-dessous, sans texte autour :

{
  "identite": {
    "nom_bot": "nom court et mémorable",
    "slogan": "phrase d'accroche courte ou vide",
    "langue_principale": "fr ou en selon la langue de la description"
  },
  "personnalite": {
    "ton": "un parmi: amical, professionnel, humoristique, strict, mystique, chaleureux, direct",
    "tutoiement": true ou false,
    "emojis": true ou false,
    "niveau_formalite": nombre de 1 (très décontracté) à 5 (très formel),
    "description_courte": "1 phrase sur le caractère du bot",
    "traits": ["2 à 4 traits de personnalité courts"]
  },
  "domaine_activite": {
    "categorie_principale": "commerce, restauration, sante, education, immobilier, jeu, association, usage_personnel, autre",
    "description_activite": "1 phrase résumant l'activité réelle"
  },
  "modules": [],
  "message_bienvenue": "message d'accueil cohérent avec le ton et l'activité",
  "mots_cles_declencheurs": ["3 à 6 mots-clés courts pour déclencher le menu principal"],
  "parametres_avances": {
    "reponse_hors_sujet": "phrase si la question sort du domaine du bot",
    "escalade_humain": false
  }
}

Génère 1 à 4 modules PERTINENTS selon le contexte. Chaque module DOIT
avoir un "type" parmi : menu, faq, horaires, jeu, personnalise.
Utilise "personnalise" pour tout ce qui ne rentre pas dans les 4 autres types.
Exemples :
- menu: { "type": "menu", "titre": "Notre carte", "champs": { "items": [{"nom": "...", "prix": "...", "description": "..."}] } }
- faq: { "type": "faq", "titre": "Questions fréquentes", "champs": { "paires": [{"question": "...", "reponse": "..."}] } }
- horaires: { "type": "horaires", "titre": "Nos horaires", "champs": { "jours": {"lundi": "9h-18h"} } }
- jeu: { "type": "jeu", "titre": "Jeux disponibles", "champs": { "jeux_actifs": ["rpg"] } }
- personnalise: { "type": "personnalise", "titre": "titre libre", "champs": { "paires": [{"label": "...", "valeur": "..."}] } }

Ne mets AUCUN texte avant ou après le JSON.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const data = await response.json();
    const brut = data.choices[0].message.content.trim();
    const generated = JSON.parse(brut);

    return validerEtNettoyerConfig(generated);
  } catch (error) {
    log.error(`Erreur génération config bot: ${error.message}`);
    return { ...CONFIG_PAR_DEFAUT, _erreur_generation: true };
  }
}

function validerEtNettoyerConfig(config) {
  const propre = {
    identite: { ...CONFIG_PAR_DEFAUT.identite, ...(config.identite || {}) },
    personnalite: { ...CONFIG_PAR_DEFAUT.personnalite, ...(config.personnalite || {}) },
    domaine_activite: { ...CONFIG_PAR_DEFAUT.domaine_activite, ...(config.domaine_activite || {}) },
    modules: [],
    message_bienvenue: config.message_bienvenue || CONFIG_PAR_DEFAUT.message_bienvenue,
    mots_cles_declencheurs: Array.isArray(config.mots_cles_declencheurs) && config.mots_cles_declencheurs.length
      ? config.mots_cles_declencheurs : CONFIG_PAR_DEFAUT.mots_cles_declencheurs,
    parametres_avances: { ...CONFIG_PAR_DEFAUT.parametres_avances, ...(config.parametres_avances || {}) },
  };

  if (!TONS_VALIDES.includes(propre.personnalite.ton)) propre.personnalite.ton = 'amical';
  propre.personnalite.niveau_formalite = Math.min(5, Math.max(1, Number(propre.personnalite.niveau_formalite) || 3));
  if (!Array.isArray(propre.personnalite.traits)) propre.personnalite.traits = [];

  const modulesBruts = Array.isArray(config.modules) ? config.modules : [];
  propre.modules = modulesBruts.slice(0, 6).map((m, i) => {
    const typeValide = TYPES_MODULES_CONNUS.includes(m.type) ? m.type : 'personnalise';
    let champs = m.champs || {};
    if (typeValide === 'jeu') {
      champs = { jeux_actifs: (champs.jeux_actifs || []).filter(j => JEUX_DISPONIBLES.includes(j)) };
    }
    if (typeValide === 'personnalise' && !Array.isArray(champs.paires)) {
      champs = { paires: Object.entries(champs).map(([label, valeur]) => ({ label, valeur: typeof valeur === 'string' ? valeur : JSON.stringify(valeur) })) };
    }
    return { id: `module_${i}_${Date.now()}`, type: typeValide, titre: m.titre || 'Module', champs };
  });

  return propre;
}

export function construirePromptSystemeDepuisConfig(config) {
  const { identite, personnalite, domaine_activite, modules, parametres_avances } = config;

  const blocsModules = modules.map(m => {
    switch (m.type) {
      case 'menu':
        return `${m.titre} :\n` + (m.champs.items || []).map(it => `- ${it.nom}${it.prix ? ` (${it.prix})` : ''}${it.description ? ` : ${it.description}` : ''}`).join('\n');
      case 'faq':
        return `${m.titre} :\n` + (m.champs.paires || []).map(p => `Q: ${p.question}\nR: ${p.reponse}`).join('\n');
      case 'horaires':
        return `${m.titre} :\n` + Object.entries(m.champs.jours || {}).map(([jour, h]) => `${jour} : ${h}`).join('\n');
      case 'jeu':
        return `${m.titre} : fonctionnalités actives -> ${(m.champs.jeux_actifs || []).join(', ') || 'aucune'}`;
      case 'personnalise':
      default:
        return `${m.titre} :\n` + (m.champs.paires || []).map(p => `${p.label} : ${p.valeur}`).join('\n');
    }
  }).join('\n\n');

  return `Tu es ${identite.nom_bot}${identite.slogan ? ` — "${identite.slogan}"` : ''}, un assistant WhatsApp.
Domaine d'activité : ${domaine_activite.description_activite}
Ton : ${personnalite.ton} (niveau de formalité ${personnalite.niveau_formalite}/5).
Tu ${personnalite.tutoiement ? 'tutoies' : 'vouvoies'} les utilisateurs.
${personnalite.emojis ? 'Tu utilises des emojis avec modération.' : 'Tu n\'utilises pas d\'emojis.'}
Traits de caractère : ${personnalite.traits.join(', ') || 'neutre'}.
${personnalite.description_courte}

INFORMATIONS QUE TU CONNAIS ET QUE TU PEUX UTILISER POUR RÉPONDRE :
${blocsModules || '(aucune information spécifique enregistrée)'}

Si une question sort totalement de ton domaine, réponds : "${parametres_avances.reponse_hors_sujet}"
${parametres_avances.escalade_humain ? 'Si la demande est complexe ou sensible, propose de transférer à un humain.' : ''}

Reste toujours dans ce personnage, ne mentionne jamais que tu es une IA générique.`;
}

