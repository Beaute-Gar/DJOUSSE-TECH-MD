import { createLogger } from '../../infrastructure/logger.js';
import { rechercherActualites, formatterResultatsRecherche } from '../../ainoria-intelligence/core/web-search.js';

const log = createLogger('AUTO-PUB');

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

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'midday';
  return 'evening';
}

const THEME_KEYWORDS = {
  gaming: 'jeux vidéo',
  roblox: 'Roblox',
  anime: 'anime japonais',
  famille: 'famille parentalité',
  travail: 'travail productivité',
  commerce: 'business Cameroun',
  education: 'éducation apprentissage',
  sport: 'sport football',
  technologie: 'technologie Cameroun',
  religion: 'religion spiritualité',
  musique: 'musique africaine',
  communaute: 'vie communautaire',
  general: 'actualité général',
};

export class AutoPublisher {
  constructor(sock) {
    this.sock = sock;
    this.schedules = new Map();
    this.publishedHistory = new Map();
  }

  async startForGroup(groupJid, groupName, groupType) {
    if (this.schedules.has(groupJid)) return;
    const type = groupType || 'general';
    log.info(`Démarrage auto-publisher pour ${groupName} (${type})`);

    const scheduleNext = (period) => {
      const now = new Date();
      let targetHour;
      if (period === 'morning') targetHour = 8;
      else if (period === 'midday') targetHour = 12;
      else targetHour = 20;

      const target = new Date(now);
      target.setHours(targetHour, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      const timer = setTimeout(async () => {
        try {
          await this.publish(groupJid, groupName, type, period);
        } catch (e) {
          log.warn(`Publication échouée: ${e.message}`);
        }
        const nextPeriod = period === 'morning' ? 'midday' : period === 'midday' ? 'evening' : 'morning';
        scheduleNext(nextPeriod);
      }, target - now);

      this.schedules.set(groupJid, { timer, period });
    };

    scheduleNext(getTimeOfDay());
  }

  async publish(groupJid, groupName, groupType, period) {
    log.info(`Publication ${period} pour ${groupName}`);

    const keyword = THEME_KEYWORDS[groupType] || 'actualité général';
    const results = await rechercherActualites(keyword, 5);
    const hasResults = results.length > 0;

    let system = `Tu es un membre actif d'un groupe WhatsApp nommé "${groupName}". Écris UN SEUL message court (2-3 phrases) pour lancer une discussion.`;
    if (period === 'morning') system += ' Commence par un bonjour dynamique et une info intéressante ou une citation. Termine par une question.';
    else if (period === 'midday') system += ' Pose une question engageante ou un sondage rapide sur un sujet intéressant.';
    else system += ' Propose un débat léger ou un partage d\'expérience sur la journée.';
    system += ' Ne dis jamais que tu es une IA. Sois naturel. Pas de salutation longue. 5-12 mots max par phrase.';

    let user = `Écris un message pour un groupe ${groupType}.`;
    if (hasResults) {
      const webInfo = results.map((r, i) => `${i+1}. ${r.titre}: ${r.extrait}`).join('\n');
      system += '\n\nInspire-toi de ces actualités récentes pour rendre ton message pertinent et actuel, sans copier mot pour mot :';
      user += `\n\nActualités récentes sur le thème "${keyword}":\n${webInfo}`;
    }

    let content = await groqGenerate(system, user);
    if (!content) {
      content = hasResults
        ? `Au fait les gars, vous avez vu ça ? ${results[0].titre} — ${results[0].extrait.slice(0, 100)}... Qu'est-ce que vous en pensez ?`
        : `Hey ! ${period === 'morning' ? 'Bonne journée' : period === 'midday' ? 'Bonne après-midi' : 'Bonne soirée'} à tous !`;
    }

    try {
      await this.sock.sendMessage(groupJid, { text: content });
      if (!this.publishedHistory.has(groupJid)) this.publishedHistory.set(groupJid, []);
      const history = this.publishedHistory.get(groupJid);
      history.push({ period, timestamp: Date.now(), sources: results.length });
      if (history.length > 30) history.splice(0, 10);
      log.info(`Publication envoyée: ${groupName} (${period}) — ${results.length} sources web`);
    } catch (e) {
      log.error(`Erreur publication ${groupName}: ${e.message}`);
    }
  }

  stopForGroup(groupJid) {
    const schedule = this.schedules.get(groupJid);
    if (schedule) {
      clearTimeout(schedule.timer);
      this.schedules.delete(groupJid);
      this.publishedHistory.delete(groupJid);
    }
  }

  isActive(groupJid) {
    return this.schedules.has(groupJid);
  }
}

let _instance = null;

export function getAutoPublisher(sock) {
  if (!_instance && sock) _instance = new AutoPublisher(sock);
  return _instance;
}
