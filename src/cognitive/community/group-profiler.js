import { createLogger } from '../../core/logger.js';
import { EVENTS, bus } from '../event-bus.js';
import { communityStore } from './community-store.js';
import { addNode, NODE_TYPES } from '../knowledge-graph.js';

const log = createLogger('SCG:PROFILER');
const MIN_CONFIDENCE = 0.3;

const GROUP_TYPES = {
  gaming: { keywords: ['jeu', 'game', 'gaming', 'roblox', 'minecraft', 'free fire', 'pubg',
    'fortnite', 'tournoi', 'tournament', 'niveau', 'level', 'score', 'kills', 'win', 'win rate',
    'gg', 'ez', 'tryhard', 'lol', 'xp', 'coach', 'rank', 'classement', 'saison'],
    animations: ['quiz gaming', 'défi gaming', 'classement', 'tournoi', 'blind test'] },
  anime: { keywords: ['anime', 'manga', 'naruto', 'one piece', 'demon slayer', 'jujutsu',
    'attack on titan', 'bleach', 'dragon ball', 'otaku', 'waifu', 'episode', 'scan', 'chapitre'],
    animations: ['quiz anime', 'devinette anime', 'blind test anime'] },
  ecole: { keywords: ['école', 'ecole', 'classe', 'cours', 'prof', 'devoir', 'exercice',
    'examen', 'composition', 'révision', 'revision', 'note', 'matière', 'math', 'français',
    'histoire', 'science', 'physique', 'chimie', 'bac', 'concours'],
    animations: ['quiz révision', 'défi mémoire', 'questions ouvertes', 'sondage matière'] },
  entreprise: { keywords: ['entreprise', 'business', 'projet', 'client', 'vente', 'chiffre',
    'objectif', 'réunion', 'reunion', 'meeting', 'strategy', 'stratégie', 'marketing',
    'budget', 'facture', 'contrat', 'prestation', 'service', 'produit', 'partenariat'],
    animations: ['sondage pro', 'annonce', 'statistiques', 'défi équipe'] },
  famille: { keywords: ['famille', 'maman', 'papa', 'frere', 'soeur', 'cousin', 'tata',
    'tonton', 'grand-mere', 'grand-pere', 'enfant', 'bébé', 'mariage', 'anniversaire',
    'reunion famille', 'fête', 'vacances'],
    animations: ['activité familiale', 'sondage famille', 'jeu famille', 'anniversaire'] },
  association: { keywords: ['association', 'membre', 'bureau', 'président', 'trésorier',
    'secretaire', 'réunion', 'adhesion', 'cotisation', 'statuts', 'règlement', 'pvs',
    'assemblée', 'AG', 'benevole', 'evenement'],
    animations: ['annonce', 'sondage', 'rappels', 'défi adhésion'] },
  football: { keywords: ['football', 'foot', 'match', 'ligue', 'champion', 'coupe', 'but',
    'ballon', 'joueur', 'entraineur', 'stade', 'liga', 'premier league', 'serie a',
    'laliga', 'ligue des champions', 'mercato', 'transfert'],
    animations: ['quiz foot', 'pronostic match', 'classement', 'défi pronos'] },
  musique: { keywords: ['musique', 'music', 'chanson', 'artiste', 'album', 'playlist',
    'spotify', 'concert', 'clip', 'parole', 'rap', 'hip hop', 'rnb', 'afro', 'coupé décalé',
    'makossa', 'bikutsi', 'zouk', 'reggae', 'dancehall', 'instrument', 'rythme'],
    animations: ['blind test', 'quiz musique', 'défi chant', 'kanaoke'] },
  dev: { keywords: ['code', 'programmation', 'dev', 'javascript', 'python', 'react', 'node',
    'github', 'api', 'frontend', 'backend', 'fullstack', 'app', 'application', 'debug',
    'algorithme', 'base de donnees', 'sql', 'serveur', 'framework'],
    animations: ['défi code', 'quiz tech', 'questions dev'] },
  crypto: { keywords: ['crypto', 'bitcoin', 'ethereum', 'solana', 'nft', 'blockchain',
    'wallet', 'mining', 'staking', 'defi', 'token', 'altcoin', 'trade', 'invest'],
    animations: ['quiz crypto', 'analyse marché', 'sondage invest'] },
  support: { keywords: ['aide', 'help', 'support', 'assistance', 'probleme', 'bug', 'erreur',
    'comment', 'pourquoi', 'merci', 'svp', 'urgent', ' besoin'],
    animations: ['ticket aide', 'faq', 'statistiques'] },
};

const TONE_KEYWORDS = {
  positif: ['merci', 'bravo', 'genial', 'super', 'cool', 'nice', 'bon', 'excellent',
    'parfait', 'daccord', 'ok', 'bien'],
  negatif: ['non', 'pas', 'mal', 'triste', 'colere', 'enerve', 'fache', 'degoute',
    'horrible', 'nul', 'naze', 'pourri'],
  humoristique: ['lol', 'mdr', 'ptdr', 'haha', '😄', '😂', '🤣', 'rire', 'blague', 'humour'],
  formel: ['bonjour', 'madame', 'monsieur', 'cher', 'respect', 'honneur', 'veuillez'],
};

function detectGroupType(messages) {
  const scores = {};
  const allText = messages.join(' ').toLowerCase();
  const words = allText.split(/\s+/);

  for (const [type, config] of Object.entries(GROUP_TYPES)) {
    let count = 0;
    for (const kw of config.keywords) {
      if (allText.includes(kw)) {
        count += kw.length > 5 ? 2 : 1;
      }
    }
    if (count > 0) scores[type] = count / Math.max(1, words.length);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { type: 'general', confidence: 0, animations: ['sondage', 'question', 'annonce'] };
  if (sorted[0][1] < MIN_CONFIDENCE) return { type: 'general', confidence: sorted[0][1], animations: ['sondage', 'question', 'annonce'] };

  const best = sorted[0];
  return {
    type: best[0],
    confidence: Math.min(1, best[1]),
    animations: GROUP_TYPES[best[0]].animations,
  };
}

function detectTone(messages) {
  const allText = messages.join(' ').toLowerCase();
  const scores = {};
  for (const [tone, kws] of Object.entries(TONE_KEYWORDS)) {
    scores[tone] = kws.reduce((s, kw) => s + (allText.split(kw).length - 1), 0);
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted[0] && sorted[0][1] > 0) return sorted[0][0];
  return 'neutre';
}

function extractTopics(messages) {
  const topicMap = {};
  const stopWords = ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'je', 'tu',
    'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'et', 'ou', 'mais', 'donc',
    'car', 'ni', 'que', 'qui', 'quoi', 'dont', 'pas', 'plus', 'est', 'sont', 'dans',
    'sur', 'avec', 'pour', 'sans', 'par', 'a', 'au', 'aux', 'en'];

  for (const msg of messages) {
    const words = msg.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !stopWords.includes(w)) {
        topicMap[w] = (topicMap[w] || 0) + 1;
      }
    }
  }

  return Object.entries(topicMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function detectActivityLevel(totalMessages, memberCount, uptimeHours) {
  if (uptimeHours < 1) return 'debut';
  const msgsPerHour = totalMessages / Math.max(1, uptimeHours);
  if (msgsPerHour > 50) return 'trea_actif';
  if (msgsPerHour > 20) return 'actif';
  if (msgsPerHour > 5) return 'modere';
  if (msgsPerHour > 1) return 'calme';
  return 'inactif';
}

export function registerGroupProfiler(pipeline) {
  const messageBuffer = {};
  const BUFFER_SIZE = 50;
  const REANALYZE_INTERVAL = 3600000;

  pipeline.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
    const { jid, senderJid, text, isGroup, episode } = data;
    if (!isGroup || !text) return;

    communityStore.recordActivity(jid, senderJid);

    if (!messageBuffer[jid]) messageBuffer[jid] = [];
    messageBuffer[jid].push(text);
    if (messageBuffer[jid].length > BUFFER_SIZE * 2) {
      messageBuffer[jid] = messageBuffer[jid].slice(-BUFFER_SIZE);
    }

    const profile = communityStore.getGroupProfile(jid);
    if (profile.analyzed && Date.now() - profile.lastAnalyzed < REANALYZE_INTERVAL) return;

    if (messageBuffer[jid].length >= BUFFER_SIZE || (!profile.analyzed && messageBuffer[jid].length >= 20)) {
      const typeResult = detectGroupType(messageBuffer[jid]);
      const tone = detectTone(messageBuffer[jid]);
      const topics = extractTopics(messageBuffer[jid]);

      communityStore.updateGroupProfile(jid, {
        type: typeResult.type,
        confidence: typeResult.confidence,
        animations: typeResult.animations,
        tone,
        topics,
        lastAnalyzed: Date.now(),
        analyzed: true,
      });

      bus.emit('scg:profile:updated', { groupJid: jid, profile: typeResult, tone, topics });

      addNode(`profile:${jid}`, NODE_TYPES.CONCEPT, {
        groupJid: jid, type: typeResult.type, confidence: typeResult.confidence,
        tone, topics, timestamp: Date.now(),
      }).catch(() => {});

      log.info(`Group ${jid} profiled as ${typeResult.type} (${Math.round(typeResult.confidence * 100)}%)`);
    }
  }, { priority: 75, description: 'scg:profiler' });

  pipeline.on('heartbeat:hour', async () => {
    for (const jid of communityStore.getAllGroups()) {
      const stats = communityStore.getStats(jid);
      const totalMsgs = stats.totalMessages;
      const today = new Date().toISOString().slice(0, 10);
      const todayMsgs = stats.dailyActivity[today] || 0;

      const level = detectActivityLevel(totalMsgs, 0, 0);
      communityStore.updateGroupProfile(jid, { activityLevel: level, updatedAt: Date.now() });
    }
  }, { priority: 10, description: 'scg:profiler:activity' });

  log.info('[SCG:PROFILER] Registered');
}
