import { LRUCache } from '../../infrastructure/deploy/v2.2-patch.js';

const PERSONAS = {
  gaming: {
    catchphrases: ['Franchement...', 'Les gars...', 'Sérieux...', 'Wesh...'],
    emojis: ['🎮', '🔥', '💪', '😎', '👊', '🏆'],
    slang: ['osef', 'mdr', 'ptdr', 'tkt', 'bg', 'sah', 'fracasser'],
  },
  famille: {
    catchphrases: ['La famille...', 'Vous savez quoi...'],
    emojis: ['❤️', '🙏', '😊', '🏠', '✨'],
    slang: [],
  },
  travail: {
    catchphrases: ['Écoutez...', 'Honnêtement...', 'En vrai...'],
    emojis: ['💼', '📊', '💰', '🤝', '📈'],
    slang: ['cash', 'béton', 'solide', 'carré'],
  },
  commerce: {
    catchphrases: ['Alors...', 'Pour info...', 'Au fait...'],
    emojis: ['🏪', '💰', '✅', '📦', '🤝'],
    slang: [],
  },
  education: {
    catchphrases: ['En fait...', 'Tu vois...', "Le truc c'est que..."],
    emojis: ['📚', '🧠', '💡', '✍️', '🎓'],
    slang: ['capté', 'pigé', 'galérer'],
  },
  sport: {
    catchphrases: ['Les gars...', 'Allez...', 'C\'est clair...'],
    emojis: ['⚽', '💪', '🔥', '🏆', '🎯'],
    slang: ['allez', 'coupé', 'frappe'],
  },
  technologie: {
    catchphrases: ['Donc...', 'En gros...', 'Concrètement...'],
    emojis: ['💻', '🔧', '⚡', '🛠️', '🚀'],
    slang: ['debug', 'merge', 'push'],
  },
  religion: {
    catchphrases: ['Que Dieu vous bénisse...', 'EnshaAllah...', 'Dieu est grand...'],
    emojis: ['🙏', '🕊️', '✨', '❤️', '📖'],
    slang: [],
  },
  communaute: {
    catchphrases: ['La communauté...', 'On est ensemble...', 'Du coup...'],
    emojis: ['🌍', '🤝', '💪', '❤️', '👊'],
    slang: [],
  },
  general: {
    catchphrases: ['Franchement...', 'Écoute...', 'En vrai...'],
    emojis: ['💬', '🤔', '👍', '😄', '✨'],
    slang: ['mdr', 'tkt'],
  },
};

const UNKNOWN_RESPONSES = [
  "Alors là franchement... j'en sais rien du tout 😅",
  "Bonne question ça ! J'avoue je sèche un peu là...",
  "Hmm laisse-moi réfléchir... Non vraiment je vois pas désolé",
  "Tu m'as eu là ! Aucune idée pour le coup",
  "Ptdr j'allais dire un truc mais non en fait j'en sais rien mdr",
  "Franchement... je pourrais te dire n'importe quoi mais je préfère être honnête : je sais pas",
  "Attends... non, rien. Désolé je capte pas trop là 😂",
];

const CONFUSED_RESPONSES = [
  "Attends j'ai pas bien compris là... tu peux répéter ?",
  "Euh... tu peux reformuler ? J'ai pas trop capté désolé",
  "Je suis un peu largué là, explique-moi mieux stp",
  "Désolé j'ai le cerveau qui rame aujourd'hui, tu peux redire ? 😅",
  "J'avoue j'ai rien compris, tu peux être plus clair ?",
];

const TRANSITIONS = [
  "Ah ouais je vois ce que tu veux dire...",
  "C'est une bonne question ça !",
  "Alors attends, laisse-moi te dire...",
  "Tu sais quoi ?",
  "En vrai, c'est pas si compliqué...",
  "Franchement, le truc c'est que...",
  "Tiens d'ailleurs, tant que j'y pense...",
];

const HESITATIONS = ['Euh...', 'Hmm...', 'Alors...', 'Comment dire...', 'Du coup...'];

const THANKS_RESPONSES = [
  "Pas de souci !",
  "Tkt c'est normal !",
  "Avec plaisir !",
  "Pas de problème, c'est fait pour ça !",
  "De rien mon gars !",
  "Aucun souci 👍",
];

const recentResponses = new LRUCache(20, 300000);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function similarity(a, b) {
  const wa = new Set(a.toLowerCase().split(/\s+/));
  const wb = new Set(b.toLowerCase().split(/\s+/));
  const inter = new Set([...wa].filter(x => wb.has(x)));
  const union = new Set([...wa, ...wb]);
  return union.size ? inter.size / union.size : 0;
}

function removeRobotic(text) {
  return text
    .replace(/selon mes (données|informations|recherches)/gi, "d'après ce que j'ai vu")
    .replace(/en tant qu'IA/gi, "de mon côté")
    .replace(/je suis une intelligence artificielle/gi, "je suis quelqu'un qui s'y connaît un peu")
    .replace(/mon algorithme/gi, "mon expérience")
    .replace(/les données (indiquent|montrent|suggèrent)/gi, "ce que j'ai remarqué c'est que")
    .replace(/je vous (conseille|recommande)/gi, "je te conseille")
    .replace(/n'hésitez pas/gi, "n'hésite pas")
    .replace(/veuillez/gi, "tu peux")
    .replace(/merci de votre (attention|compréhension)/gi, "merci d'avoir lu")
    .replace(/cordialement/gi, "à plus")
    .replace(/je reste à votre disposition/gi, "si t'as besoin, fais-moi signe")
    .replace(/\bIA\b/gi, "moi")
    .replace(/intelligence artificielle/gi, "assistant")
    .replace(/modèle de langage/gi, "cerveau");
}

function makeCasual(text) {
  return text
    .replace(/\bvous\b/gi, "tu")
    .replace(/\bvotre\b/gi, "ton")
    .replace(/\bvos\b/gi, "tes")
    .replace(/\bje suis\b/gi, "j'suis")
    .replace(/\bje ne sais pas\b/gi, "j'sais pas")
    .replace(/\bil y a\b/gi, "y a")
    .replace(/\bje ne\b/gi, "j'")
    .replace(/\bce n'est pas\b/gi, "c'est pas")
    .replace(/\bil n'y a pas\b/gi, "y a pas")
    .replace(/\bje vais\b/gi, "j'vais")
    .replace(/\btu es\b/gi, "t'es");
}

function convertBullets(text) {
  return text
    .replace(/^1[.)]\s*/gm, "D'abord, ")
    .replace(/^2[.)]\s*/gm, "Ensuite, ")
    .replace(/^3[.)]\s*/gm, "Et puis, ")
    .replace(/^4[.)]\s*/gm, "Aussi, ")
    .replace(/^5[.)]\s*/gm, "Enfin, ");
}

function addEmoji(text, emojis) {
  const count = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length;
  if (count >= 2) return text;
  const emoji = pick(emojis);
  return Math.random() < 0.5 ? text + ' ' + emoji : emoji + ' ' + text;
}

function optimizeLength(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 3) return text;
  if (sentences.length > 6) {
    const key = sentences.find(s => /important|essentiel|clé|bref/i.test(s)) || sentences[Math.floor(sentences.length / 2)];
    return sentences[0] + ' ' + key;
  }
  return text;
}

export function humanizeResponse(aiResponse, context = {}) {
  const {
    groupType = 'general',
    groupId = '',
    originalMessage = '',
  } = context;

  const persona = PERSONAS[groupType] || PERSONAS.general;
  const lower = (aiResponse || '').toLowerCase();
  const origLower = (originalMessage || '').toLowerCase();

  if (!aiResponse || aiResponse.trim().length < 3) {
    return pick(UNKNOWN_RESPONSES);
  }

  if (/je (ne )?(sais|connais) pas/i.test(lower) ||
      /je n'ai pas (trouvé|compris|grand chose)/i.test(lower) ||
      /je ne peux pas/i.test(lower) ||
      /pas d'information/i.test(lower)) {
    if (origLower.includes('qui')) return "Franchement j'en sais rien moi... Je connais pas toutes les personnes du monde mdr 😂";
    if (origLower.includes('quand')) return "Ah ça parfois... aucune idée de quand. Faudrait que je regarde mais j'ai la flemme là 😅";
    if (origLower.includes('pourquoi')) return "Bonne question ! Pourquoi ? Aucune idée en vrai... C'est la vie hein 🤷";
    if (origLower.includes('comment')) return "Comment on fait... franchement j'ai pas la réponse. Si quelqu'un sait, qu'il nous éclaire !";
    return pick(UNKNOWN_RESPONSES);
  }

  if (/je ne comprends pas/i.test(lower) || /peux-tu (reformuler|préciser)/i.test(lower)) {
    return pick(CONFUSED_RESPONSES);
  }

  let response = aiResponse;
  response = removeRobotic(response);
  response = makeCasual(response);

  if (response.length > 50 && Math.random() < 0.6) {
    response = pick(TRANSITIONS) + ' ' + response.charAt(0).toLowerCase() + response.slice(1);
  }

  if (Math.random() < 0.08) {
    const h = pick(HESITATIONS);
    const pt = Math.floor(response.length / 3);
    response = response.substring(0, pt) + ' ' + h + ' ' + response.substring(pt);
  }

  if (/\d+\.\s/.test(response)) response = convertBullets(response);

  response = addEmoji(response, persona.emojis);

  if (persona.slang.length && Math.random() < 0.15) {
    const slang = pick(persona.slang);
    response = response.replace(/\.$/, ` ${slang}.`);
  }

  if (origLower.includes('merci')) {
    response += '\n\n' + pick(THANKS_RESPONSES);
  }

  if (origLower.includes('qui es-tu') || origLower.includes("t'es qui")) {
    response += '\n\n(C\'est moi DJOUSSE, le gars qui traîne dans le groupe 😂)';
  }

  const key = `resp:${groupId}`;
  const prev = recentResponses.get(key);
  if (prev && similarity(response, prev) > 0.7) {
    response = "Comme je disais... " + response.charAt(0).toLowerCase() + response.slice(1);
  }
  recentResponses.set(key, response);

  return optimizeLength(response);
}
