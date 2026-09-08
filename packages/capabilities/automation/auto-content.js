import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('AUTO-CONTENT');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function groqGenerate(system, user) {
  const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.8, max_completion_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

const TYPE_PROFILES = {
  gaming: {
    types: ['astuce_jeu', 'news_jeu', 'meme_gaming', 'question_gaming', 'tournoi'],
    tones: ['fun', 'passionné', 'décontracté'],
    emojis: ['🎮', '🔥', '🎯', '🏆', '💪'],
    schedule: { morning: 'astuce_jeu', midday: 'question_gaming', evening: 'tournoi' },
  },
  commerce: {
    types: ['opportunite', 'conseil_business', 'success_story', 'reseau', 'formation'],
    tones: ['professionnel', 'motivant', 'inspirant'],
    emojis: ['💰', '💼', '📊', '🤝', '💡'],
    schedule: { morning: 'conseil_business', midday: 'opportunite', evening: 'reseau' },
  },
  education: {
    types: ['question_jour', 'astuce_etude', 'quiz', 'citation', 'conseil'],
    tones: ['pédagogique', 'encourageant', 'clair'],
    emojis: ['📚', '🧠', '💪', '🎯', '✏️'],
    schedule: { morning: 'citation', midday: 'question_jour', evening: 'astuce_etude' },
  },
  famille: {
    types: ['pensee_positive', 'recette', 'activite', 'conseil_parent', 'jeu'],
    tones: ['chaleureux', 'bienveillant', 'simple'],
    emojis: ['👨‍👩‍👧‍👦', '💝', '🍽️', '🎲', '☀️'],
    schedule: { morning: 'pensee_positive', midday: 'recette', evening: 'activite' },
  },
  sport: {
    types: ['actu_sport', 'defi', 'conseil_fitness', 'pronostic', 'motivation'],
    tones: ['dynamique', 'motivant', 'passionné'],
    emojis: ['⚽', '💪', '🔥', '🏃', '🎯'],
    schedule: { morning: 'defi', midday: 'conseil_fitness', evening: 'actu_sport' },
  },
  technologie: {
    types: ['astuce_code', 'news_tech', 'outil', 'tutoriel', 'debug'],
    tones: ['technique', 'précis', 'pédagogique'],
    emojis: ['💻', '🛠️', '📱', '🔧', '⚡'],
    schedule: { morning: 'news_tech', midday: 'astuce_code', evening: 'tutoriel' },
  },
  religion: {
    types: ['verset', 'priere', 'reflexion', 'enseignement', 'temoignage'],
    tones: ['respectueux', 'spirituel', 'doux'],
    emojis: ['🙏', '📖', '🕊️', '✨', '💫'],
    schedule: { morning: 'verset', midday: 'priere', evening: 'reflexion' },
  },
  musique: {
    types: ['decouverte', 'citation_musique', 'battle', 'top_playlist', 'news'],
    tones: ['créatif', 'passionné', 'décontracté'],
    emojis: ['🎵', '🎤', '🔥', '🎧', '🎼'],
    schedule: { morning: 'citation_musique', midday: 'decouverte', evening: 'battle' },
  },
  general: {
    types: ['question_jour', 'citation', 'info_utile', 'defi', 'sondage'],
    tones: ['naturel', 'adaptable', 'convivial'],
    emojis: ['💬', '✨', '🤔', '🎯', '📢'],
    schedule: { morning: 'citation', midday: 'question_jour', evening: 'sondage' },
  },
};

function getProfile(type) {
  return TYPE_PROFILES[type] || TYPE_PROFILES.general;
}

export async function generatePost(groupName, groupType, timeOfDay, context = {}) {
  const profile = getProfile(groupType);
  const contentType = profile.schedule[timeOfDay] || profile.types[0];
  const tone = profile.tones[Math.floor(Math.random() * profile.tones.length)];
  const emoji = profile.emojis[Math.floor(Math.random() * profile.emojis.length)];

  const systemPrompt = `Tu es un community manager expert pour le groupe WhatsApp "${groupName}".
Ton style : ${tone}. Type de groupe : ${groupType}.
Génère un post court et engageant (2-3 phrases) en français africain.
Termine par une question pour engager la conversation.
Ne mentionne jamais que tu es une IA ou un bot.
N'utilise pas de hashtags.`;

  const examples = {
    astuce_jeu: '🎮 Les gars ! Nouveau mode dispo sur Fortnite. Qui a déjà testé ? Vos impressions ? 🔥',
    question_gaming: '🎯 Question aux gamers :quel est votre jeu le plus sous-coté ? Moi je commence : Days Gone 👇',
    tournoi: '🏆 TOURNOI SURPRISE ! Ce soir 21h en 1v1. 5000 FCFA de recharge à gagner. Inscrivez-vous en dessous !',
    opportunite: '💼 FLASH : un partenaire cherche 5 revendeurs à Abidjan. Marge 35%. Intéressés ? DM.',
    conseil_business: '💡 Saviez-vous que 70% des ventes en CI se font via WhatsApp Business ? Besoin d\'un tuto ?',
    question_jour: '🤔 Qu\'avez-vous prévu aujourd\'hui ? Moi c\'est organisation et productivité 💪',
    citation: '💪 "Le succès c\'est tomber 7 fois, se relever 8." — Qui en a besoin aujourd\'hui ?',
    pensee_positive: '☀️ Bonne famille ! Que cette journée soit remplie de joie et de sourires. On commence fort !',
    recette: '🍽️ Qui a une bonne recette à partager avec nous aujourd\'hui ? On veut tout savoir !',
    defi: '🎯 DÉFI DU JOUR : 20 pompes maintenant ! Faites-le et dites nous combien vous avez fait !',
    actu_sport: '⚽ Gros match ce soir ! Pronostics ? Moi je dis 2-1. Et vous ?',
    news_tech: '📱 WhatsApp vient de lancer les messages vocaux à vitesse variable. Enfin ! Qui utilise déjà ?',
    astuce_code: '💻 Petit tips dev : utilisez console.table() au lieu de console.log() pour voir vos données. Game changer !',
    verset: '📖 "Tout est possible à celui qui croit." — Marc 9:23. Belle journée à tous 🙏',
    decouverte: '🎵 Nouveau son de Didi B dans la playlist ! Qui l\'a écouté ? Donnez votre note sur 10',
    sondage: '📢 Petit sondage : vous préférez les matins ou les soirs pour discuter ici ?',
    info_utile: '📢 Orange Money : nouveau plafond à 500 000 FCFA/jour. Utile pour vos transactions !',
  };
  const example = examples[contentType] || examples.question_jour;

  const prompt = `Groupe : "${groupName}" (${groupType})
Moment : ${timeOfDay}
Contexte : ${context.recent || 'premier post'}
Type de contenu : ${contentType}

Exemple de style à adapter :
${example}

Génère maintenant un post de ${contentType} pour "${groupName}" :`;

  let post = await groqGenerate(systemPrompt, prompt);
  if (!post || post.includes("pas grand chose")) {
    post = example;
  }
  return `${emoji} ${post}`;
}

export async function generateDayContent(groupName, groupType) {
  const times = [
    { time: '08:00', period: 'morning', label: '☀️' },
    { time: '12:30', period: 'midday', label: '🌤️' },
    { time: '20:00', period: 'evening', label: '🌙' },
  ];
  const posts = [];
  for (const slot of times) {
    const content = await generatePost(groupName, groupType, slot.period);
    posts.push({ time: slot.time, content });
  }
  return posts;
}

export async function startAutoContent(sock, groupJid, groupName, groupType) {
  if (!sock) return;
  log.info(`Auto-content démarré pour ${groupName} (${groupType})`);

  const scheduleNext = (delayMs) => {
    const timer = setTimeout(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        let period = 'morning';
        if (hour >= 11 && hour < 17) period = 'midday';
        else if (hour >= 17) period = 'evening';

        const post = await generatePost(groupName, groupType, period);
        if (post) {
          await sock.sendMessage(groupJid, { text: post }).catch(() => {});
        }
      } catch (e) {
        log.warn(`auto-content error: ${e.message}`);
      }
      scheduleNext(8 * 60 * 60 * 1000);
    }, delayMs);
    if (global._autoContentTimers) global._autoContentTimers.push(timer);
  };

  const now = new Date();
  const hours = now.getHours();
  let firstDelay = 60 * 60 * 1000;
  if (hours < 8) firstDelay = (8 - hours) * 60 * 60 * 1000;
  else if (hours < 12) firstDelay = (12 - hours) * 60 * 60 * 1000;
  else if (hours < 20) firstDelay = (20 - hours) * 60 * 60 * 1000;

  if (!global._autoContentTimers) global._autoContentTimers = [];
  scheduleNext(firstDelay);
}

export function stopAutoContent(groupJid) {
  if (global._autoContentTimers) {
    global._autoContentTimers.forEach(t => clearTimeout(t));
    global._autoContentTimers = [];
  }
}
