import { createLogger } from '../../infrastructure/logger.js';
import { humanizeResponse } from '../core/human-response.js';
import { LRUCache } from '../../infrastructure/deploy/v2.2-patch.js';
import { detectGroupType } from '../core/unified-detector.js';

const log = createLogger('AUTO');

const TRUSTED_DOMAINS = [
  'google.com', 'youtube.com', 'github.com', 'wikipedia.org',
  'whatsapp.com', 'facebook.com', 'instagram.com', 'roblox.com',
  'minecraft.net', 'epicgames.com', 'twitter.com', 'linkedin.com',
];

const SPAM_PATTERNS = [
  /gagnez?\s+\d+[k]?\s*(€|euros?|f\s*cfa|dollars?|\$)/i,
  /cliquez?\s+(ici|vite|maintenant)/i,
  /partagez?\s+(ça|ce message)\s+(à|avec)\s+\d+/i,
  /devenez?\s+(riche|millionnaire)/i,
  /investissement\s+(miracle|garanti|100\s*%)/i,
];

const INSULT_PATTERNS = [
  /\bcon(nard|nasse)?\b/i, /\bidiot[e]?\b/i, /\bstupide\b/i,
  /\bdébile\b/i, /\bmerde(ux)?\b/i, /\bput(e|ain)\b/i,
  /\bsalaud\b/i, /\benculé\b/i, /\bta gueule\b/i,
];

const CONTENT_BY_HOUR = {
  gaming: {
    8: "☀️ *Bonjour les gamers !*\n\nQuestion du jour : Quel est le jeu qui vous a le plus marqué cette année ? 🤔\n\nPartagez en commentaire ! 🎮",
    12: "🎮 *PAUSE MIDI !*\n\nPetit devinez le jeu avec ces emojis : 🏝️🔫🏗️\n\nRéponse dans 30 min !",
    20: "🌙 *SOIRÉE GAMING !*\n\nQui est chaud pour une session ce soir ? Dites quel jeu ! 🔥",
  },
  education: {
    8: "☀️ *Bonjour !*\n\nLe saviez-vous ? Apprendre 30 min le matin est 3x plus efficace que le soir.\n\nBonne journée d'étude ! 📚",
    12: "📚 *PAUSE MIDI*\n\nQuiz rapide : Quelle est la capitale du Sénégal ?\nA) Abidjan  B) Dakar  C) Bamako",
    20: "🌙 *RÉVISIONS DU SOIR*\n\nAstuce : relisez vos cours 10 min avant de dormir, c'est le meilleur moment pour mémoriser ! 🧠",
  },
  general: {
    8: "☀️ *Bonjour la team !*\n\nQuoi de prévu aujourd'hui ?\nExcellente journée à tous ! ✨",
    12: "🌤️ *MIDI !*\n\nPetite pause bien méritée. Qui a prévu quoi pour le déjeuner ?",
    20: "🌙 *BONNE SOIRÉE !*\n\nLa journée se termine. Prenez du temps pour vous ! ✨",
  },
};

const QUIZ_QUESTIONS = {
  gaming: [
    { q: "Quel jeu a popularisé les Battle Royale ?", r: "PUBG" },
    { q: "Qui a créé Minecraft ?", r: "Notch" },
  ],
  education: [
    { q: "Quelle est la capitale du Cameroun ?", r: "Yaoundé" },
    { q: "Combien de continents y a-t-il ?", r: "7" },
  ],
  general: [
    { q: "Quelle est la capitale de la Côte d'Ivoire ?", r: "Yamoussoukro" },
    { q: "En quelle année a été inventé Internet ?", r: "1969" },
  ],
};

class AutonomousSystem {
  constructor(sock) {
    this.sock = sock;
    this.groups = new Map();
    this.knowledgeBase = new LRUCache(500, 86400000);
    this.stats = {
      messagesAnalyzed: 0,
      questionsAnswered: 0,
      spamBlocked: 0,
      membersWelcomed: 0,
      quizzesLaunched: 0,
      publicationsMade: 0,
      startTime: Date.now(),
    };
    this.intervals = [];
  }

  async boot() {
    log.info('Démarrage autonome...');

    await this.discoverGroups();
    this.startScheduledTasks();

    log.info(`Système autonome opérationnel — ${this.groups.size} groupes`);
  }

  async discoverGroups() {
    try {
      const raw = await this.sock.groupFetchAllParticipating();
      const botJid = (this.sock.user?.id || '').replace(/:.*@/, '@');

      for (const [jid, meta] of Object.entries(raw)) {
        const botPart = meta.participants?.find(p => p.id.replace(/:.*@/, '@') === botJid);
        const isAdmin = botPart?.admin === 'admin' || botPart?.admin === 'superadmin';

        const type = this.detectType(meta.subject, meta.desc || '');

        this.groups.set(jid, {
          id: jid,
          name: meta.subject,
          type,
          isAdmin,
          memberCount: meta.participants?.length || 0,
          active: true,
          lastPublish: 0,
          lastQuiz: 0,
        });
      }
      log.info(`${this.groups.size} groupes découverts (${[...this.groups.values()].filter(g => g.isAdmin).length} admin)`);
    } catch (e) {
      log.warn(`discoverGroups: ${e.message}`);
    }
  }

  detectType(name, desc) {
    const result = detectGroupType(name, desc);
    return result.type;
  }

  startScheduledTasks() {
    this.intervals.push(setInterval(() => this.scheduledCleanup(), 21600000));
    this.intervals.push(setInterval(() => this.healthCheck(), 300000));
  }

  async handleGroupMessage(groupId, msg, text) {
    const group = this.groups.get(groupId);
    if (!group?.active) return null;

    this.stats.messagesAnalyzed++;

    const threat = this.detectThreat(text);
    if (threat) {
      await this.handleThreat(groupId, msg, threat);
      return null;
    }

    return null;
  }

  detectThreat(text) {
    const lower = text.toLowerCase();
    const hasLink = /https?:\/\/[^\s]+/.test(text);

    if (hasLink) {
      const url = text.match(/https?:\/\/([^\s/]+)/)?.[1] || '';
      const trusted = TRUSTED_DOMAINS.some(d => url.includes(d));
      if (!trusted && SPAM_PATTERNS.some(p => p.test(lower))) {
        return { type: 'spam_link', severity: 'high' };
      }
      if (!trusted) return { type: 'suspicious_link', severity: 'medium' };
    }

    if (SPAM_PATTERNS.some(p => p.test(lower))) return { type: 'spam', severity: 'medium' };
    if (INSULT_PATTERNS.some(p => p.test(lower))) return { type: 'insult', severity: 'high' };

    return null;
  }

  async handleThreat(groupId, msg, threat) {
    try {
      await this.sock.sendMessage(groupId, { delete: msg.key });
    } catch {}

    const sender = msg.key?.participant || msg.key?.remoteJid;
    const warnings = {
      spam_link: "⚠️ Votre message avec un lien suspect a été supprimé.",
      suspicious_link: "⚠️ Votre lien a été supprimé (non autorisé).",
      spam: "⚠️ Votre message a été supprimé (spam).",
      insult: "🚫 Message supprimé pour insulte. Prochaine fois = exclusion.",
    };

    try {
      await this.sock.sendMessage(sender, { text: warnings[threat.type] || warnings.spam });
    } catch {}

    if (threat.severity === 'high') {
      try {
        await this.sock.sendMessage(groupId, {
          text: "🛡️ *MODÉRATION AUTO*\n\nUn message inapproprié a été supprimé. Respectez les règles svp.",
        });
      } catch {}
    }

    this.stats.spamBlocked++;
    log.info(`Menace ${threat.type} bloquée`);
  }

  isQuestion(text) {
    return text.includes('?') ||
      /^(qui|que|quoi|comment|pourquoi|quand|où|quel|quelle|combien)/i.test(text);
  }

  async autoAnswer(groupId, msg, question, group) {
    const cached = this.knowledgeBase.get(question.toLowerCase().substring(0, 50));
    if (cached) return cached;

    try {
      const { askGroq } = await import('./brain.js');
      const prompt = `Tu es DJOUSSE TECH, membre du groupe "${group.name}" (type: ${group.type}). Réponds de manière naturelle et amicale. Max 3 phrases. Ne dis jamais que tu es une IA.`;
      const raw = await askGroq(prompt, question).catch(() => null);
      if (raw) {
        const human = humanizeResponse(raw, { groupType: group.type, groupId, originalMessage: question });
        this.knowledgeBase.set(question.toLowerCase().substring(0, 50), human);
        this.stats.questionsAnswered++;
        return human;
      }
    } catch {}

    return null;
  }

  async scheduledPublish() {
    const hour = new Date().getHours();
    if (![8, 12, 20].includes(hour)) return;

    for (const [jid, group] of this.groups) {
      if (!group.active) continue;
      if (Date.now() - group.lastPublish < 3600000) continue;

      const templates = CONTENT_BY_HOUR[group.type] || CONTENT_BY_HOUR.general;
      const content = templates[hour];
      if (!content) continue;

      try {
        await this.sock.sendMessage(jid, { text: content });
        group.lastPublish = Date.now();
        this.stats.publicationsMade++;
        log.info(`Publication ${hour}h dans ${group.name}`);
      } catch (e) {
        log.warn(`Publish ${group.name}: ${e.message}`);
      }
    }
  }

  async scheduledQuiz() {
    for (const [jid, group] of this.groups) {
      if (!group.active) continue;
      if (Date.now() - group.lastQuiz < 7200000) continue;
      if (Math.random() > 0.3) continue;

      const questions = QUIZ_QUESTIONS[group.type] || QUIZ_QUESTIONS.general;
      const q = questions[Math.floor(Math.random() * questions.length)];

      try {
        await this.sock.sendMessage(jid, {
          text: `🧠 *QUIZ !*\n\n${q.q}\n\nPremier à répondre gagne mon respect ! 😎\n⏱️ 30 secondes — GO !`,
        });
        group.lastQuiz = Date.now();
        this.stats.quizzesLaunched++;
      } catch {}
    }
  }

  scheduledCleanup() {
    if (this.knowledgeBase.size > 400) {
      log.info(`Nettoyage base connaissances (${this.knowledgeBase.size} entrées)`);
    }
  }

  healthCheck() {
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 60000);
    const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    log.debug(`Santé: ${uptime}min | ${this.groups.size} groupes | ${mem}MB | ${this.stats.messagesAnalyzed} msgs`);
  }

  getStats() {
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 60000);
    return { ...this.stats, uptime, groups: this.groups.size, knowledgeSize: this.knowledgeBase.size };
  }

  destroy() {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
  }
}

let _instance = null;

export function getAutonomousSystem(sock) {
  if (!_instance && sock) _instance = new AutonomousSystem(sock);
  return _instance;
}

export { AutonomousSystem };
