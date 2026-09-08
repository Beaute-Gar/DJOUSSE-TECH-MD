import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('SMARTCTX');

const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const locationCache = new Map();
const convContext = new Map();

async function groqQuery(messages, maxTokens = 300) {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { return null; }
}

export function detectIntent(text) {
  const t = text.toLowerCase().trim();
  if (/combien\s+(co[uû]te?|font?|vaut?|coute)|taux\s+de|conversion|change|en\s+(fcfa|xaf|euro|doll|usd|eur|livre|gbp|yen|ngn|naira|cfa|franc)/i.test(t) && /\d+/.test(t)) return 'currency';
  if (/m[eé]t[eé]o|temps\s+(qu'il|dehors|aujourd'hui|demain)|quel\s+temps|weather|pluie|soleil|temp[eé]rature|quelle\s+heure/i.test(t) && !/mdr|haha|blague/i.test(t)) return 'weather';
  if (/(?:cr[ée]e?|g[ée]n[èe]re?|dessine|imagine|fais)\s+(?:moi\s+)?(?:une\s+)?image/i.test(t)) return 'image';
  if (/traduis?|traduct|traduction|en\s+(fran[cç]ais|anglais|espagnol|allemand)/i.test(t)) return 'translate';
  if (/(?:quel[ ']?[eè]?|quelle)\s+(?:est\s+)?(?:ton?\s+)?(?:nom|pr[eé]nom)\s/i.test(t)) return 'identity';
  if (/je\s+t'aime?|je\s+suis\s+amoureux?|tu\s+me\s+plais|sortir\s+(?:avec\s+)?moi|t'es\s+(?:c[ée]libataire|libre)|tu\s+(?:as\s+)?un\s+(?:mari|femme|copain|copine)/i.test(t)) return 'flirt';
  if (/quelle\s+heure|il\s+est\s+\d+|donne\s+moi\s+l'heure/i.test(t)) return 'time';
  return 'chat';
}

export async function getAutoLocation(jid) {
  if (locationCache.has(jid)) {
    const entry = locationCache.get(jid);
    if (Date.now() - entry.ts < 86400000) return entry;
  }
  const prefix = jid?.replace(/[^0-9]/g, '')?.slice(0, 4);
  const paysParPrefixe = {
    '237': { pays: 'Cameroun', ville: 'Douala', fuseau: 'Africa/Douala', langue: 'fr', monnaie: 'XAF' },
    '225': { pays: "Côte d'Ivoire", ville: 'Abidjan', fuseau: 'Africa/Abidjan', langue: 'fr', monnaie: 'XOF' },
    '221': { pays: 'Sénégal', ville: 'Dakar', fuseau: 'Africa/Dakar', langue: 'fr', monnaie: 'XOF' },
    '223': { pays: 'Mali', ville: 'Bamako', fuseau: 'Africa/Bamako', langue: 'fr', monnaie: 'XOF' },
    '229': { pays: 'Bénin', ville: 'Cotonou', fuseau: 'Africa/Porto-Novo', langue: 'fr', monnaie: 'XOF' },
    '228': { pays: 'Togo', ville: 'Lomé', fuseau: 'Africa/Lome', langue: 'fr', monnaie: 'XOF' },
    '224': { pays: 'Guinée', ville: 'Conakry', fuseau: 'Africa/Conakry', langue: 'fr', monnaie: 'GNF' },
    '226': { pays: 'Burkina Faso', ville: 'Ouagadougou', fuseau: 'Africa/Ouagadougou', langue: 'fr', monnaie: 'XOF' },
    '227': { pays: 'Niger', ville: 'Niamey', fuseau: 'Africa/Niamey', langue: 'fr', monnaie: 'XOF' },
    '242': { pays: 'Congo', ville: 'Brazzaville', fuseau: 'Africa/Brazzaville', langue: 'fr', monnaie: 'XAF' },
    '243': { pays: 'RDC', ville: 'Kinshasa', fuseau: 'Africa/Kinshasa', langue: 'fr', monnaie: 'CDF' },
    '241': { pays: 'Gabon', ville: 'Libreville', fuseau: 'Africa/Libreville', langue: 'fr', monnaie: 'XAF' },
    '233': { pays: 'Ghana', ville: 'Accra', fuseau: 'Africa/Accra', langue: 'en', monnaie: 'GHS' },
    '234': { pays: 'Nigeria', ville: 'Lagos', fuseau: 'Africa/Lagos', langue: 'en', monnaie: 'NGN' },
    '254': { pays: 'Kenya', ville: 'Nairobi', fuseau: 'Africa/Nairobi', langue: 'en', monnaie: 'KES' },
    '256': { pays: 'Uganda', ville: 'Kampala', fuseau: 'Africa/Kampala', langue: 'en', monnaie: 'UGX' },
    '255': { pays: 'Tanzania', ville: 'Dar es Salaam', fuseau: 'Africa/Dar_es_Salaam', langue: 'en', monnaie: 'TZS' },
    '212': { pays: 'Maroc', ville: 'Casablanca', fuseau: 'Africa/Casablanca', langue: 'fr', monnaie: 'MAD' },
    '213': { pays: 'Algérie', ville: 'Alger', fuseau: 'Africa/Algiers', langue: 'fr', monnaie: 'DZD' },
    '216': { pays: 'Tunisie', ville: 'Tunis', fuseau: 'Africa/Tunis', langue: 'fr', monnaie: 'TND' },
    '261': { pays: 'Madagascar', ville: 'Antananarivo', fuseau: 'Indian/Antananarivo', langue: 'fr', monnaie: 'MGA' },
    '33': { pays: 'France', ville: 'Paris', fuseau: 'Europe/Paris', langue: 'fr', monnaie: 'EUR' },
    '1': { pays: 'États-Unis', ville: 'New York', fuseau: 'America/New_York', langue: 'en', monnaie: 'USD' },
  };
  let location = { pays: 'Cameroun', ville: 'Douala', fuseau: 'Africa/Douala', langue: 'fr', monnaie: 'XAF' };
  for (const [p, info] of Object.entries(paysParPrefixe)) {
    if (prefix?.startsWith(p)) { location = info; break; }
  }
  try {
    const res = await fetch(`https://ipapi.co/json/`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const ipInfo = await res.json();
      if (ipInfo.city) location.ville = ipInfo.city;
      if (ipInfo.country_name) location.pays = ipInfo.country_name;
      if (ipInfo.timezone) location.fuseau = ipInfo.timezone;
      if (ipInfo.currency) location.monnaie = location.monnaie || ipInfo.currency;
    }
  } catch {}
  locationCache.set(jid, { ...location, ts: Date.now() });
  log.info(`Location: ${location.ville}, ${location.pays} | TZ: ${location.fuseau}`);
  return location;
}

export function getLocalTime(fuseau) {
  try {
    const now = new Date();
    const options = { timeZone: fuseau || 'Africa/Douala', hour: '2-digit', minute: '2-digit', hour12: false };
    return now.toLocaleTimeString('fr-FR', options);
  } catch { return '--:--'; }
}

export function getLocalDate(fuseau) {
  try {
    const now = new Date();
    const options = { timeZone: fuseau || 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long' };
    return now.toLocaleDateString('fr-FR', options);
  } catch { return ''; }
}

export function formatCurrencyComedy(result, useMarketJoke = false) {
  const jokes = [
    `Ah, tu veux savoir combien ça coûte en CFA ? 🤔`,
    `Laisse-moi sortir ma calculette de maestro 🧮🎶`,
    `Franchement, qui a encore besoin de l'XOF à part nous ? 😏`,
    `Le taux du jour, direct de la banque (enfin, presque) :`,
    `Calcul en cours... patience, je suis pas Google mdr`,
  ];
  const mood = [
    `Aujourd'hui, tu peux acheter ${result.resultat.toLocaleString('fr-FR')} FCFA avec ce montant ! 💪`,
    `Franchement, c'est pas donné hein ! ${result.resultat.toLocaleString('fr-FR')} CFA dans la poche. 😅`,
    `Tranquille, ça fait ${result.resultat.toLocaleString('fr-FR')} francs CFA. De quoi tenir le week-end. 💰`,
    `${result.resultat.toLocaleString('fr-FR')} balles en CFA. Pas mal, pas mal !`,
    `Franchement à ce prix-là, tu t'achètes un terrain à Bonabéri 😂`,
  ];
  const marketJoke = useMarketJoke ? `\n\n💰 *Marché noir:* ${(result.resultat * 0.97).toLocaleString('fr-FR')} FCFA (si tu connais les bonnes personnes 😏)` : '';
  return `${jokes[Math.floor(Math.random() * jokes.length)]}\n\n💱 *${result.montant} ${result.deviseSource}* → ${result.resultat.toLocaleString('fr-FR')} *${result.deviseCible}*\n📊 Taux: 1 ${result.deviseSource} = ${result.taux.toFixed(2)} ${result.deviseCible}${marketJoke}\n\n${mood[Math.floor(Math.random() * mood.length)]}`;
}

export function formatWeatherComedy(weather, location) {
  const cond = (weather.description || '').toLowerCase();
  const temp = parseInt(weather.temperature);
  const ville = weather.ville || location?.ville || 'chez toi';
  const pays = weather.pays || location?.pays || '';
  const heure = location?.fuseau ? getLocalTime(location.fuseau) : '';
  const date = location?.fuseau ? getLocalDate(location.fuseau) : '';
  let joke, outfit, morningBonus = '';

  if (heure && parseInt(heure) < 12) {
    morningBonus = `\n\n☀️ *Bonjour !* Il est ${heure}, ${date}. `;
  }

  if (cond.includes('pluie') || cond.includes('averse') || cond.includes('goutte')) {
    joke = `☔ *Il pleut aujourd'hui à ${ville}!*${morningBonus}Franchement, c'est le genre de temps où tu regrettes d'avoir lavé ton bazin hier 😅`;
    outfit = 'Conseil mode du jour : sors avec ton parapluie et tes chaussures imperméables !';
  } else if (cond.includes('soleil') || cond.includes('clair') || cond.includes('dégagé') || temp > 30) {
    joke = `☀️ *Il fait ${temp}°C à ${ville} aujourd'hui !*${morningBonus}Même les moustiques cherchent l'ombre. Attention au coup de chaud, boloss ! 🥵`;
    outfit = 'Conseil du jour : short, t-shirt léger, et n\'oublie pas la crème solaire bg !';
  } else if (cond.includes('nuage') || cond.includes('couvert')) {
    joke = `☁️ *Temps couvert à ${ville} aujourd'hui !*${morningBonus}Le ciel est indécis comme ton ex. Fais-toi beau/belle quand même !`;
    outfit = 'Prends une petite veste au cas où, on sait jamais avec ce ciel !';
  } else if (cond.includes('vent')) {
    joke = `🌬️ *Attention vents à ${ville}!* ${weather.vent_kmh} km/h !${morningBonus}C'est pas le moment de porter une perruque ou un chapeau mal fixé 😭`;
    outfit = 'Rentre tes cheveux et tiens bien ton téléphone !';
  } else if (temp < 20) {
    joke = `🥶 *Il fait ${temp}°C à ${ville}!*${morningBonus}On se croirait en Europe ma parole ! Sors couvert, la grippe guette !`;
    outfit = 'Pull, doudoune, et tout ce qui peut te garder au chaud !';
  } else {
    joke = `🌡️ *${temp}°C à ${ville} aujourd'hui.*${morningBonus}Un temps normal quoi. Rien d'exceptionnel. Bref, passe une bonne journée ! 😎`;
    outfit = 'Temps neutre, habille-toi comme tu veux. Mais fais-toi beau/belle quand même !';
  }

  return `${joke}\n\n🌡️ ${weather.temperature}°C (ressenti ${weather.ressenti}°C) | 💧 ${weather.humidite}% | 🌬 ${weather.vent_kmh} km/h ${weather.vent_dir}\n\n💡 *${outfit}*\n${weather.uv ? `\n☀️ Indice UV: ${weather.uv} — prends de la crème !` : ''}`;
}

export function formatTimeComedy(location) {
  const heure = getLocalTime(location.fuseau);
  const date = getLocalDate(location.fuseau);
  const jokes = [
    `Il est *${heure}* à ${location.ville} (${location.pays}).\n${date}. T'as l'heure, maintenant arrête de me déranger mdr ⏰`,
    `${heure} pile ! ${location.ville} — GMT${location.fuseau?.includes('+1') ? '+1' : location.fuseau?.includes('+2') ? '+2' : location.fuseau?.includes('+0') ? '' : ''}.\nFranchement t'as pas de montre toi ? 😂`,
    `Chez nous à ${location.ville}, il est *${heure}*.\n${date}. Belle journée pour glander ou pour bosser, selon qui tu es.`,
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
}

export function detectCurrencyFromText(text) {
  const t = text.toLowerCase();
  const patterns = [
    { re: /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|euro)\s+(?:en|vers|à|=>|,)\s*(?:fcfa|xaf|cfa|franc|fran\s*cfa|francs?\s*(?:cfa|xaf)?)/i, from: 'EUR', to: 'XAF' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:fcfa|xaf|cfa|franc|fran\s*cfa|francs?\s*(?:cfa|xaf)?)\s+(?:en|vers|à|=>|,)\s*(?:€|euros?|euro)/i, from: 'XAF', to: 'EUR' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?|dollar)\s+(?:en|vers|à|=>|,)\s*(?:fcfa|xaf|cfa|franc)/i, from: 'USD', to: 'XAF' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:fcfa|xaf|cfa|franc)\s+(?:en|vers|à|=>|,)\s*(?:\$|usd|dollars?|dollar)/i, from: 'XAF', to: 'USD' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|euro)\s+(?:en|vers|à|=>|,)\s*(?:\$|usd|dollars?|dollar)/i, from: 'EUR', to: 'USD' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?)\s+(?:en|vers|à|=>|,)\s*(?:€|euros?)/i, from: 'USD', to: 'EUR' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|euro)\s+(?:en|vers|à|=>|,)\s*(?:ngn|naira)/i, from: 'EUR', to: 'NGN' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:ngn|naira)\s+(?:en|vers|à|=>|,)\s*(?:€|euros?|euro)/i, from: 'NGN', to: 'EUR' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?)\s+(?:en|vers|à|=>|,)\s*(?:ngn|naira)/i, from: 'USD', to: 'NGN' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:ngn|naira)\s+(?:en|vers|à|=>|,)\s*(?:\$|usd|dollars?)/i, from: 'NGN', to: 'USD' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:ngn|naira)\s+(?:en|vers|à|=>|,)\s*(?:fcfa|xaf|cfa|franc)/i, from: 'NGN', to: 'XAF' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:fcfa|xaf|cfa|franc)\s+(?:en|vers|à|=>|,)\s*(?:ngn|naira)/i, from: 'XAF', to: 'NGN' },
    { re: /combien\s+(?:font|coute?|vaut?|coûte?)\s+(\d+(?:[.,]\d+)?)\s*(?:€|euros?|euro)\s+(?:en|=>)?\s*(?:fcfa|xaf|cfa|franc|francs?)/i, from: 'EUR', to: 'XAF' },
    { re: /combien\s+(?:font|coute?|vaut?|coûte?)\s+(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?)\s+(?:en|=>)?\s*(?:fcfa|xaf|cfa)/i, from: 'USD', to: 'XAF' },
    { re: /combien\s+(?:font|coute?|vaut?|coûte?)\s+(\d+(?:[.,]\d+)?)\s*(?:ngn|naira)\s+(?:en|=>)?\s*(?:fcfa|xaf|cfa)/i, from: 'NGN', to: 'XAF' },
    { re: /combien\s+(?:font|coute?|vaut?|coûte?)\s+(\d+(?:[.,]\d+)?)\s*(?:fcfa|xaf|cfa)\s+(?:en|=>)?\s*(?:ngn|naira)/i, from: 'XAF', to: 'NGN' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:euros?|€)\s*(?:en|=>)?\s*(?:xaf|fcfa)/i, from: 'EUR', to: 'XAF' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:xaf|fcfa)\s*(?:en|=>)?\s*(?:euros?|€)/i, from: 'XAF', to: 'EUR' },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:\$|usd)\s*(?:en|=>)?\s*xaf/i, from: 'USD', to: 'XAF' },
    { re: /(\d+(?:[.,]\d+)?)\s*ngn\s*(?:en|=>)?\s*(?:xaf|fcfa)/i, from: 'NGN', to: 'XAF' },
  ];
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (m) return { amount: parseFloat(m[1].replace(',', '.')), from: p.from, to: p.to };
  }
  if (/\d/.test(t) && (t.includes('euro') || t.includes('€')) && (t.includes('fcfa') || t.includes('xaf') || t.includes('cfa') || t.includes('franc'))) {
    const nums = text.match(/(\d+(?:[.,]\d+)?)/g);
    if (nums) return { amount: parseFloat(nums[0].replace(',', '.')), from: 'EUR', to: 'XAF' };
  }
  if (/\d/.test(t) && (t.includes('dollar') || t.includes('$')) && (t.includes('fcfa') || t.includes('xaf') || t.includes('franc'))) {
    const nums = text.match(/(\d+(?:[.,]\d+)?)/g);
    if (nums) return { amount: parseFloat(nums[0].replace(',', '.')), from: 'USD', to: 'XAF' };
  }
  if (/\d/.test(t) && (t.includes('naira') || t.includes('ngn')) && (t.includes('fcfa') || t.includes('xaf') || t.includes('franc') || t.includes('cfa'))) {
    const nums = text.match(/(\d+(?:[.,]\d+)?)/g);
    if (nums) return { amount: parseFloat(nums[0].replace(',', '.')), from: 'NGN', to: 'XAF' };
  }
  return null;
}

export async function detectWeatherCity(text, jid) {
  const cityTriggers = [/m[eé]t[eé]o\s+(.+)/i, /temps\s+(?:qu'il\s+)?(?:fait|fer[aà]?)\s+(?:à|a|sur|en|au)\s+(.+)/i, /quel\s+temps\s+(?:fait-il\s+)?(?:à|a|au|en|sur)\s+(.+)/i, /weather\s+(.+)/i, /pluie\s+(?:à|a|sur|au)\s+(.+)/i];
  for (const t of cityTriggers) {
    const m = t.exec(text);
    if (m) {
      let city = m[1].trim().replace(/[?.,!]/g, '').split(/\s+/)[0].toLowerCase();
      const villes = { douala: 'Douala', yaounde: 'Yaoundé', yaoundé: 'Yaoundé', paris: 'Paris', dakar: 'Dakar', abidjan: 'Abidjan', cotonou: 'Cotonou', lomé: 'Lomé', lome: 'Lomé', ouagadougou: 'Ouagadougou', bamako: 'Bamako', kinshasa: 'Kinshasa', lagos: 'Lagos', nairobi: 'Nairobi', casablanca: 'Casablanca', algiers: 'Alger', alger: 'Alger', tunis: 'Tunis', libreville: 'Libreville', brazzaville: 'Brazzaville', conakry: 'Conakry', accra: 'Accra', 'new york': 'New York', london: 'London', 'côte d\'ivoire': 'Abidjan' };
      if (villes[city]) return villes[city];
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  if (/qu(e|')\[est-ce\s+qu'il\s+(fait|fer[aà])|m[eé]t[eé]o|temps\s+(qu'il|dehors)|weather|quelle\s+heure/i.test(text) && !/mdr|haha|blague|drôle/i.test(text)) {
    const loc = await getAutoLocation(jid);
    if (/quelle\s+heure|il\s+est\s+\d+|donne\s+moi\s+l'heure/i.test(text)) return null;
    return loc.ville;
  }
  return null;
}

export function getConvContext(jid) {
  if (!convContext.has(jid)) convContext.set(jid, { history: [], topics: {}, persona: 'normal', flirtTarget: null, flirtActive: false, lastMood: null });
  return convContext.get(jid);
}

export async function analyzeGroupMood(jid, recentMessages) {
  const text = recentMessages.slice(-20).join('\n');
  const prompt = `Analyse cette conversation WhatsApp et réponds UNIQUEMENT par un JSON avec 4 champs:
{
  "sujet": "sujet principal de la conversation",
  "ambiance": "fun/flirt/sérieux/technique/blague/drague/détente/tension/pro/romantique/sexe/conseil",
  "persona_recommandé": "normal/humoriste/sage/motivateur/business/flirt/seduisant/ami/professeur/detective",
  "a_qui_parler": "nom de la personne la plus active ou 'tout_le_monde'"
}

TYPES D'AMBIANCE :
- flirt/drague → persona seduisant
- blague/fun → persona humoriste
- technique/pro → persona business
- sérieux/tension → persona sage
- conseil/étude → persona professeur
- romantique/sexe → persona flirt
- général → persona normal

Conversation:
${text}`;
  const res = await groqQuery([{ role: 'user', content: prompt }], 250);
  if (!res) return { sujet: 'général', ambiance: 'détente', persona: 'normal', cible: 'tout_le_monde' };
  try {
    const json = JSON.parse(res.replace(/```json|```/g, '').trim());
    return {
      sujet: json.sujet || 'général',
      ambiance: json.ambiance || 'détente',
      persona: json.persona_recommandé || 'normal',
      cible: json.a_qui_parler || 'tout_le_monde',
    };
  } catch { return { sujet: 'général', ambiance: 'détente', persona: 'normal', cible: 'tout_le_monde' }; }
}

export function getPersonaPrompt(persona, senderName = '') {
  const prompts = {
    normal: '',
    humoriste: `Tu es le boute-en-train du groupe. TOUJOURS une blague, "mdr", "ptdr", "wesh". Tu sais faire rire, lâcher des vannes.`,
    sage: `Tu es un sage africain. Proverbes, métaphores, ton calme et posé. Tu donnes des conseils réfléchis.`,
    motivateur: `Tu es un coach motivateur. "Let's go", "tu peux le faire", "crois en toi bg". Tu boosts les gens.`,
    business: `Tu es un pro du business. Concis, direct, focus résultats et ROI. Formel mais accessible. Tu parles argent, investissement, stratégie.`,
    flirt: `Tu es charmeur mais classe. Compliments subtils, jamais vulgaires. Tu sais parler aux femmes avec respect et séduction.`,
    seduisant: `Tu as un crush sur ${senderName || 'cette personne'}. Tu lui parles avec une attention spéciale, des compliments fins, de l'humour. Tu ignores poliment les interruptions.`,
    ami: `Tu es un ami proche et fidèle. Naturel, chaleureux, présent. Tu parles comme un pote de longue date.`,
    professeur: `Tu es pédagogue. Tu expliques les choses clairement avec des exemples concrets. Patient et bienveillant.`,
    detective: `Tu es curieux et méthodique. Tu poses des questions, tu analyses, tu cherches à comprendre.`,
  };
  return prompts[persona] || prompts.normal;
}

export function getDynamicSystemPrompt(jid, isGroup, senderName, groupName, persona, location) {
  const loc = location || { ville: 'Douala', pays: 'Cameroun', fuseau: 'Africa/Douala' };
  const style = getPersonaPrompt(persona, senderName);
  const heure = getLocalTime(loc.fuseau);
  return `Tu es DJOUSSE TECH, un ami qui discute sur WhatsApp.

INFO :
- Lieu : ${loc.ville}, ${loc.pays}
- Heure locale : ${heure}
- ${isGroup ? `Groupe : ${groupName || 'un groupe'}` : `Privé avec ${senderName || 'l\'utilisateur'}`}

PERSONNALITÉ :
- Naturel, chaleureux, parles comme un pote de quartier
- Utilise l'argot africain (mdr, tkt, bg, wesh, sah, franchement, jure, boloss)
- Bref et percutant : max 2-3 phrases
- JAMAIS "je suis une IA", "je suis un bot", "en tant qu'IA", "je n'ai pas accès"
- Si on demande qui tu es : "Je suis DJOUSSE TECH, ton pote !"
${style ? `\nSTYLE ACTUEL :\n${style}` : ''}

RÈGLES :
- Si on parle d'argent, conversion, taux → réponds avec le montant précis + humour
- Si on demande la météo → décris-la de façon marrante
- Si ambiance légère → tu peux flirter ou taquiner
- Parle comme un vrai Camerounais/Africain
- Termine par une question pour continuer la discussion`;
}

export async function detectFlirtTarget(text, senderName) {
  const patterns = [
    { re: /parle\s+(?:uniquement\s+|rien\s+)?(?:qu['aà]\s+|avec\s+)(\w+)/i, target: 1 },
    { re: /dragu[ée]\s+(?:moi\s+)?(\w+)/i, target: 1 },
    { re: /follow\s+(\w+)/i, target: 1 },
    { re: /matte\s+[-\s]*moi\s+(\w+)/i, target: 1 },
    { re: /cible[sz]?\s+(\w+)/i, target: 1 },
    { re: /int[eé]resse\s+toi\s+(?:à|a)\s+(\w+)/i, target: 1 },
    { re: /focus\s+(?:sur\s+)?(\w+)/i, target: 1 },
  ];
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (m) return m[p.target];
  }
  return null;
}

const MUSIC_CATEGORIES = {
  funny: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  ],
  romantic: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  ],
  awkward: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  ],
  epic: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
  ],
};

export async function getComedyMusic(category = 'funny') {
  const sources = MUSIC_CATEGORIES[category] || MUSIC_CATEGORIES.funny;
  return sources[Math.floor(Math.random() * sources.length)];
}

export function getMusicCategory(context = '') {
  const t = context.toLowerCase();
  if (t.includes('romant') || t.includes('amour') || t.includes('fille') || t.includes('meuf') || t.includes('drag')) return 'romantic';
  if (t.includes('gên') || t.includes('malais') || t.includes('silence') || t.includes('awkward')) return 'awkward';
  if (t.includes('epic') || t.includes('victoire') || t.includes('force') || t.includes('puissant')) return 'epic';
  return 'funny';
}

export async function generateComedyVoiceText(context, interrupter = '') {
  let promptText = `Génère une réponse vocale courte et drôle en français, max 15 mots.`;
  if (interrupter) {
    promptText = `${interrupter} a interrompu ta discussion. Réponds avec humour et auto-dérision, max 15 mots.`;
  } else if (context.includes('flirt') || context.includes('drag')) {
    promptText = `Tu flirtais avec quelqu'un et on t'interrompt. Réponds avec humour et charme, max 15 mots.`;
  }
  const res = await groqQuery([{ role: 'system', content: 'Tu es un humoriste camerounais. Réponds en français avec humour, max 15 mots. Utilise "mdr", "wesh", "tkt", "jure".' }, { role: 'user', content: promptText }], 80);
  return res || 'Wesh laissez-moi tranquille non mdr !';
}

export async function generateMorningWeather(ville, pays, fuseau, meteo, context = '') {
  const temp = parseInt(meteo.temperature);
  const cond = (meteo.description || '').toLowerCase();
  const heure = getLocalTime(fuseau);
  const date = getLocalDate(fuseau);

  const greetings = [
    `☀️ *Bonjour ${ville}!* Il est ${heure}, ${date}.`,
    `🌅 *Réveil à ${ville}!* ${heure} — ${date}.`,
    `👋 *Coucou ${ville}!* ${heure}, ${date}.`,
  ];
  const intro = greetings[Math.floor(Math.random() * greetings.length)];

  const jokes = {
    pluie: `Aujourd'hui : *${meteo.temperature}°C* et de la pluie. Comme d'hab, le ciel pleure plus que toi après une rupture 😭`,
    soleil: `Aujourd'hui : *${meteo.temperature}°C* et un soleil radieux ! Parfait pour aller dehors... ou pas, vu la chaleur 🥵`,
    nuage: `Aujourd'hui : *${meteo.temperature}°C*, ciel couvert. Le temps est indécis, un peu comme toi le lundi matin 😅`,
    vent: `Aujourd'hui : *${meteo.temperature}°C* avec du vent (${meteo.vent_kmh} km/h). Attache ta perruque si t'en as une !`,
    froid: `Aujourd'hui : *${meteo.temperature}°C* seulement. Sors couvert, la grippe ne fait pas de cadeaux !`,
    normal: `Aujourd'hui : *${meteo.temperature}°C* à ${ville}. Un temps normal. Profite de ta journée bg ! 😎`,
  };

  let joke;
  if (cond.includes('pluie') || cond.includes('averse')) joke = jokes.pluie;
  else if (cond.includes('soleil') || cond.includes('clair') || temp > 30) joke = jokes.soleil;
  else if (cond.includes('nuage') || cond.includes('couvert')) joke = jokes.nuage;
  else if (cond.includes('vent')) joke = jokes.vent;
  else if (temp < 20) joke = jokes.froid;
  else joke = jokes.normal;

  return `${intro}\n\n🌤 *Météo du jour — ${ville}* ${pays ? `(${pays})` : ''}\n\n${joke}\n\n🌡️ ${meteo.temperature}°C (ressenti ${meteo.ressenti}°C) | 💧 ${meteo.humidite}% | 🌬 ${meteo.vent_kmh} km/h ${meteo.vent_dir}\n\n${meteo.uv ? `☀️ Indice UV: ${meteo.uv} — n'oublie pas la crème !\n\n` : ''}_Publié à ${heure}_`;
}

export function detectUnansweredProposals(history, botName = 'DJ') {
  if (!history || history.length < 2) return null;
  const last = history[history.length - 1];
  const lastSender = last?.sender?.toLowerCase() || '';
  if (lastSender === botName.toLowerCase() || lastSender.includes('bot') || lastSender.includes('djousse')) return null;
  const recent = history.slice(-15);
  const botMessages = recent.filter(m => m.sender?.toLowerCase() === botName.toLowerCase() || m.sender?.toLowerCase().includes('djousse') || m.sender?.toLowerCase().includes('bot'));
  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    if (!msg || !msg.message) continue;
    const sender = msg.sender || '';
    const text = msg.message || '';
    if (sender.toLowerCase() === botName.toLowerCase()) continue;
    const responded = recent.slice(i + 1).some(m => {
      const s = m.sender?.toLowerCase() || '';
      return s === botName.toLowerCase() || s.includes('djousse') || s.includes('bot');
    });
    if (responded) continue;
    if (/quelqu'un\s+(a|veut|pour)|qui\s+(veut|connait|a|peut)|y'a\s+(quelqu'un|personne)|personne\s+(ne|n['a])/i.test(text)) return msg;
    if (/on\s+(joue|fait|essaie|tente|organise)|qui\s+veut|est-ce\s+que\s+quelqu'un/i.test(text) && (/\?/.test(text) || text.length > 20)) return msg;
    if (/devine|devinette|enigme|blague|jeu|quiz|challenge|d[eé]fi/i.test(text) && /\?/.test(text)) return msg;
    if (/(?:propose|sugg[eè]re|id[eé]e|avis|pensez|pense)\s*(vous|tu|quelqu'un)?/i.test(text) && /\?/.test(text)) return msg;
    if (/^[A-Z].*\?\s*$/m.test(text) && text.length > 15 && text.length < 200) {
      const notRhetorical = !/n'est-ce pas|hein|quoi|non\s*\?/i.test(text);
      if (notRhetorical && !botMessages.some(b => Math.abs((b.timestamp || 0) - (msg.timestamp || 0)) < 300000)) return msg;
    }
  }
  return null;
}

export default { detectIntent, getAutoLocation, getLocalTime, getLocalDate, formatCurrencyComedy, formatWeatherComedy, formatTimeComedy, detectCurrencyFromText, detectWeatherCity, getConvContext, analyzeGroupMood, getPersonaPrompt, getDynamicSystemPrompt, detectFlirtTarget, getComedyMusic, getMusicCategory, generateComedyVoiceText, generateMorningWeather, detectUnansweredProposals, MUSIC_CATEGORIES };
