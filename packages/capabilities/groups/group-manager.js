import { createLogger } from '../../infrastructure/logger.js';
import { detectGroupType as unifiedDetect, getRulesForType, getToneForType } from '../../ainoria-intelligence/core/unified-detector.js';

const log = createLogger('GROUP-MGR');

const activatedGroups = new Map();
const FLOOD_LIMIT = 7;
const FLOOD_WINDOW_MS = 60000;
const MAX_ACTIVATED = 50;

const SCAM_PATTERNS = [
  /(gagne|gagner)\s*\d+[kkm]/i,
  /(clique|cliquer|clic)\s*ici/i,
  /(inscri|inscription)\s*(toi|vous|gratuit)/i,
  /(code|codex)\s*(promo|offre)/i,
  /(carte|cartex?)\s*(cadeau|gratuit)/i,
  /(bitcoin|crypto|minage)/i,
  /\b(\d+[.]?\d*)\s*(euros?|francs?|f cfa|usd|eur)\b.*(gratuit|offert)/i,
];

const INSULT_PATTERNS = [
  /(pute|salop|connard|encul|fdp|batard|bâtard|nique|merdeux)/i,
  /(va\s*chier|trou\s*du\s*cul|fils\s*de\s*pute)/i,
];

const SPAM_PATTERNS = [
  /(abonne|abonne-toi|subscribe|suivre)/i,
  /(partage|partager)\s*(mon|ma|mes)\s*(lien|groupe|numéro)/i,
  /(groupe|grp)\s*(whatsapp|telegram|wha)\s*(vip|prive|privé)/i,
  /(argent\s*facile|travail\s*à.*domicile)/i,
  /(viagra|cialis|medicament|médicament).*(sans.*ordonnance)/i,
];

const PHISHING_PATTERNS = [
  /(mot\s*de\s*passe|password|mdp)\s*(:|envoyer|donner)/i,
  /(code\s*whatsapp|code\s*confirmation)\s*(:|envoyer)/i,
  /(vérifie|verifie|confirme)\s*(ton|votre)\s*(compte|identité)/i,
];

const PRONO_PATTERNS = [
  /(vidéo.*chaude|video.*chaude|sex|porno|xvideos|pornhub|onlyfans)/i,
  /(nue?|nudes|nu(e)?s?)\s*(envoie|envoyer|dm)/i,
];

function getGroupData(groupJid) {
  if (!activatedGroups.has(groupJid)) {
    activatedGroups.set(groupJid, {
      activatedAt: null,
      activatedBy: null,
      groupName: '',
      groupType: 'general',
      webContext: '',
      rules: [],
      prompt: '',
      trustScores: new Map(),
      floodMap: new Map(),
      warnCount: new Map(),
      lastMessage: null,
      settings: {
        antilink: true,
        antibot: true,
        welcome: true,
        antispam: true,
        autoModerate: true,
      },
      messageCount: 0,
    });
  }
  return activatedGroups.get(groupJid);
}

export function isGroupActivated(groupJid) {
  const data = activatedGroups.get(groupJid);
  return data && data.activatedAt !== null;
}

export function activateGroup(groupJid, by, groupName = '', webContext = '', rules = [], prompt = '') {
  if (activatedGroups.size >= MAX_ACTIVATED) {
    const oldest = [...activatedGroups.entries()]
      .filter(([, d]) => d.activatedAt !== null)
      .sort(([, a], [, b]) => a.activatedAt - b.activatedAt)[0];
    if (oldest) deactivateGroup(oldest[0]);
  }
  const data = getGroupData(groupJid);
  data.activatedAt = Date.now();
  data.activatedBy = by;
  data.groupName = groupName;
  data.webContext = webContext;
  data.rules = rules;
  data.prompt = prompt;
  log.info(`Group activated: ${groupName} (${groupJid})`);
}

export function deactivateGroup(groupJid) {
  const data = activatedGroups.get(groupJid);
  if (data) {
    data.activatedAt = null;
    data.activatedBy = null;
    data.prompt = '';
    data.rules = [];
    data.webContext = '';
  }
}

export function setGroupSettings(groupJid, settings) {
  const data = getGroupData(groupJid);
  Object.assign(data.settings, settings);
}

export function getGroupSettings(groupJid) {
  return getGroupData(groupJid).settings;
}

export function getAllActivatedGroups() {
  return [...activatedGroups.entries()]
    .filter(([, d]) => d.activatedAt !== null)
    .map(([jid, d]) => ({
      jid,
      name: d.groupName,
      type: d.groupType,
      activatedAt: d.activatedAt,
      activatedBy: d.activatedBy,
      messageCount: d.messageCount,
      membersTrusted: [...d.trustScores.values()].filter(s => s >= 50).length,
    }));
}

export function getAllGroupsRaw() {
  return activatedGroups;
}

export function getGroupInfo(groupJid) {
  return getGroupData(groupJid);
}

async function duckDuckGoSearch(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const data = await res.json();
    const parts = [];
    if (data.AbstractText) parts.push(data.AbstractText);
    if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource}`);
    if (data.RelatedTopics?.length) {
      for (const t of data.RelatedTopics.slice(0, 3)) {
        if (t.Text) parts.push(t.Text);
        if (t.Topics) t.Topics.slice(0, 2).forEach(st => { if (st.Text) parts.push(st.Text); });
      }
    }
    if (data.Infobox?.content) {
      data.Infobox.content.slice(0, 5).forEach(c => {
        if (c.label && c.value) parts.push(`${c.label}: ${c.value}`);
      });
    }
    return parts.join('\n').slice(0, 2000);
  } catch (e) {
    log.warn(`DuckDuckGo search failed: ${e.message}`);
    return '';
  }
}

function detectGroupType(groupName, context) {
  const result = unifiedDetect(groupName, context);
  return result.type;
}

function generateRules(groupName, groupType, context = '') {
  const specific = getRulesForType(groupType);
  const base = [
    'Suis les instructions des administrateurs',
    'Signale tout comportement suspect à un admin',
  ];
  return [...specific, ...base];
}

function generatePrompt(groupName, groupType, rules, context = '') {
  const desc = 'un groupe WhatsApp';
  const rulesText = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const contextInfo = context ? `\nContexte du groupe:\n${context.slice(0, 1000)}\n` : '';

  return `Tu es DJOUSSE TECH, un membre actif de "${groupName}", ${desc}. Tu participes naturellement aux conversations comme un humain.

CARACTÉRISTIQUES DU GROUPE:
- Type: ${groupType}
- Nom: ${groupName}${contextInfo}
- Règles:
${rulesText}

TON COMPORTEMENT:
- Tu es chaleureux, naturel et bienveillant
- Tu aides, conseilles, et participes aux discussions
- Tu modères calmement si tu vois une règle enfreinte (rappelle la règle sans agressivité)
- Tu signales aux admins les comportements graves (insultes, spam, arnaques)
- Tu accueilles les nouveaux membres chaleureusement
- Tu ne dis JAMAIS que tu es une IA, un bot, ou un assistant

RÈGLES ABSOLUES:
- Ne dis jamais que tu es une IA, un bot, un assistant ou un modèle de langage
- Si on te demande qui tu es, dis que tu es DJOUSSE TECH, un humain
- Tu es là pour aider le groupe à bien fonctionner`;
}

export async function searchAndPrepareGroup(groupJid, groupName) {
  log.info(`Recherche contexte pour: ${groupName}`);
  const context = await duckDuckGoSearch(groupName);
  const groupType = detectGroupType(groupName, context);
  const rules = generateRules(groupName, groupType, context);
  const prompt = generatePrompt(groupName, groupType, rules, context);
  return { groupType, context, rules, prompt };
}

export function analyzeMessage(text, groupJid, senderJid) {
  const data = getGroupData(groupJid);
  let risk = 0;
  let reasons = [];

  if (!text || text.startsWith('.')) return { risk, reasons, flags: [] };

  for (const p of SCAM_PATTERNS) {
    if (p.test(text)) { risk += 40; reasons.push('arnaque'); break; }
  }
  for (const p of INSULT_PATTERNS) {
    if (p.test(text)) { risk += 30; reasons.push('insulte'); break; }
  }
  for (const p of SPAM_PATTERNS) {
    if (p.test(text)) { risk += 25; reasons.push('spam'); break; }
  }
  for (const p of PHISHING_PATTERNS) {
    if (p.test(text)) { risk += 50; reasons.push('phishing'); break; }
  }
  for (const p of PRONO_PATTERNS) {
    if (p.test(text)) { risk += 20; reasons.push('contenu+18'); break; }
  }

  const lastMsg = data.lastMessage;
  if (lastMsg && lastMsg.sender === senderJid) {
    const timeDiff = Date.now() - lastMsg.time;
    const contentSim = text.length > 10 && lastMsg.text && (
      text === lastMsg.text || text.includes(lastMsg.text.slice(0, 20))
    );
    if (contentSim && timeDiff < 30000) {
      risk += 10; reasons.push('répétition');
    }
  }
  data.lastMessage = { sender: senderJid, text, time: Date.now() };

  return { risk, reasons: [...new Set(reasons)], flags: reasons };
}

export function checkFlood(groupJid, senderJid) {
  const data = getGroupData(groupJid);
  const now = Date.now();
  if (!data.floodMap.has(senderJid)) {
    data.floodMap.set(senderJid, []);
  }
  const timestamps = data.floodMap.get(senderJid);
  timestamps.push(now);
  const recent = timestamps.filter(t => now - t < FLOOD_WINDOW_MS);
  data.floodMap.set(senderJid, recent);
  return recent.length > FLOOD_LIMIT;
}

export function updateTrustScore(groupJid, senderJid, delta) {
  const data = getGroupData(groupJid);
  const key = senderJid.split('@')[0];
  const current = data.trustScores.get(key) || 50;
  const newScore = Math.max(0, Math.min(100, current + delta));
  data.trustScores.set(key, newScore);
  return newScore;
}

export function getTrustScore(groupJid, senderJid) {
  const data = getGroupData(groupJid);
  const key = senderJid.split('@')[0];
  return data.trustScores.get(key) ?? 50;
}

export function getAllTrustScores(groupJid) {
  const data = getGroupData(groupJid);
  return [...data.trustScores.entries()]
    .map(([jid, score]) => ({ jid, score }))
    .sort((a, b) => b.score - a.score);
}
