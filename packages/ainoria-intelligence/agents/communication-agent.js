import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
import { createLogger } from '../../infrastructure/logger.js';
import { generateDynamicRules } from '../governance/dynamic-rules.js';
import { startAutoContent, stopAutoContent } from '../../capabilities/automation/auto-content.js';
import { getAutoPublisher } from '../../capabilities/publishing/auto-publisher.js';
import { formatGroupActivation, formatFeatures, formatRules, formatStatus, formatGroupsList, formatTrust, formatProfile, formatAlert, formatWarning, formatWelcome } from '../../connectors/whatsapp/adapter-baileys/display-formatter.js';
import { detectGroupType as unifiedDetect, getRulesForType, getFullRulesForType, getToneForType } from '../core/unified-detector.js';
import { GroupResearcher } from '../../capabilities/groups/group-researcher.js';
import { Conversations } from '../../infrastructure/database/database.js';
import { checkRateLimit } from '../../infrastructure/security/rateLimit.js';
import { safeSendMessage, sanitizeInput, detectInsults, detectSpam, LRUCache } from '../../infrastructure/deploy/v2.2-patch.js';
import { getConversationEngine } from '../core/conversation-engine.js';

const log = createLogger('CM');

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

const CFG = {
  maxMemoryTokens : 8_000,
  maxReplyTokens  : 1_024,
  maxRetry        : 5,
  baseRetryMs     : 3_000,
  floodWindow     : 60_000,
  floodLimit      : 7,
  socAdminThreshold: 70,
};

const activatedGroups = {};
const memory = {};
const floodMap = {};
const botSentKeys = new Set();

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function normalizeJid(jid = '') {
  return jid.split('@')[0].split(':')[0];
}

function estimateTokens(text = '') { return Math.ceil(text.length / 4); }

function getHistory(jid) {
  if (!memory[jid]) memory[jid] = [];
  return memory[jid];
}

function pushHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  let total = h.reduce((s, m) => s + estimateTokens(m.content), 0);
  while (total > CFG.maxMemoryTokens && h.length > 2) {
    total -= estimateTokens(h.splice(0, 1)[0].content);
  }
  try { Conversations.save(jid, role, content); } catch {}
}

export function clearHistory(jid) {
  memory[jid] = [];
  try { Conversations.clear(jid); } catch {}
}

export function trackBotMessage(keyId) {
  if (!keyId) return;
  botSentKeys.add(keyId);
  if (botSentKeys.size > 200) {
    const arr = [...botSentKeys];
    arr.slice(0, 50).forEach(k => botSentKeys.delete(k));
  }
}

export function isBotOwnMessage(keyId) { return botSentKeys.has(keyId); }

const SEARCH_SOURCES = [];

// Source 1 : Google Custom Search (si clé dispo)
SEARCH_SOURCES.push(async (q) => {
  const key = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CSE_KEY;
  const cx  = process.env.GOOGLE_CX || process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null;
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const d = await res.json();
  return (d.items || []).slice(0, 3).map(i => i.snippet).filter(Boolean).join('\n').slice(0, 800) || null;
});

// Source 2 : Serper.dev (si clé dispo)
SEARCH_SOURCES.push(async (q) => {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, num: 3 }), signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return (d.organic || []).slice(0, 3).map(i => i.snippet).filter(Boolean).join('\n').slice(0, 800) || null;
});

// Source 3 : Mojeek (gratuit, sans clé)
SEARCH_SOURCES.push(async (q) => {
  const url = `https://api.mojeek.com/search?q=${encodeURIComponent(q)}&fmt=json&t=3`;
  const res = await fetch(url, { headers: { 'User-Agent': 'DjousseTechBot/3.0' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const d = await res.json();
  return (d.response?.results || []).slice(0, 3).map(i => i.desc || i.title).filter(Boolean).join('\n').slice(0, 800) || null;
});

// Source 5 : DuckDuckGo API (gratuit, sans clé)
SEARCH_SOURCES.push(async (q) => {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'DjousseTechBot/3.0' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const d = await res.json();
  return [d.Abstract, (d.RelatedTopics || []).slice(0, 3).map(t => t.Text || '').join(' ')].filter(Boolean).join('\n').slice(0, 800) || null;
});

// Source 6 : DuckDuckGo HTML (gratuit, sans clé)
SEARCH_SOURCES.push(async (q) => {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const html = await res.text();
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>/gis)].slice(0, 3).map(m => m[1].replace(/<[^>]+>/g, '')) || [];
  return snippets.join('\n').slice(0, 800) || null;
});

// Source 7 : Bing HTML (gratuit, sans clé)
SEARCH_SOURCES.push(async (q) => {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const html = await res.text();
  const snippets = [...html.matchAll(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>(.*?)<\/p>/gis)].slice(0, 3).map(m => m[1].replace(/<[^>]+>/g, ''));
  return snippets.join('\n').slice(0, 800) || null;
});

async function generateContext(groupName, groupType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const { default: axios } = await import('axios');
    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const prompt = `Tu es un assistant qui décrit des groupes WhatsApp.
Groupe: "${groupName}"
Type détecté: "${groupType}"

Donne un paragraphe (100-200 mots) qui décrit le contexte, la thématique et ce qu'on peut attendre de ce groupe.
Uniquement des faits probables basés sur le nom du groupe. En français.`;
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    }, { timeout: 10000, headers: { 'Content-Type': 'application/json' } });
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim()?.slice(0, 500) || null;
  } catch { return null; }
}

async function searchWeb(query) {
  for (const src of SEARCH_SOURCES) {
    try { const r = await src(query); if (r) return r; } catch {}
  }
  return null;
}

export { unifiedDetect as detectGroupType };

const TONE_MAP = {
  gaming      : getToneForType('gaming'),
  famille     : getToneForType('famille'),
  travail     : getToneForType('travail'),
  commerce    : getToneForType('commerce'),
  education   : getToneForType('education'),
  sport       : getToneForType('sport'),
  technologie : getToneForType('technologie'),
  religion    : getToneForType('religion'),
  communaute  : getToneForType('communaute'),
  general     : getToneForType('general'),
};

function buildGroupPrompt(groupName, groupType, webContext, rules) {
  return `Tu t'appelles DJOUSSE TECH. Tu es un membre humain de ce groupe WhatsApp, très actif et serviable.
Tu as été ajouté dans le groupe "${groupName}" par l'administrateur.

CONTEXTE DU GROUPE :
Type : ${groupType}
${webContext ? `Informations sur ce sujet :\n${webContext}` : ''}

TON COMPORTEMENT :
${TONE_MAP[groupType] || TONE_MAP.general}
- Tu réponds TOUJOURS en français (sauf si quelqu'un écrit dans une autre langue — alors tu t'adaptes)
- Tu es concis : max 3-4 paragraphes sauf si on te demande plus
- Tu gardes le contexte des échanges précédents
- Tu aides les membres, tu animes la communauté, tu détectes les problèmes

RÈGLES ABSOLUES :
- Tu ne dis JAMAIS que tu es un robot, une IA, un assistant, un bot, un modèle ou un programme
- Si quelqu'un te demande si tu es une IA : tu réponds naturellement que tu es un membre humain de l'équipe DJOUSSE TECH
- Tu ne mentionnes JAMAIS Groq, Llama, OpenAI, Anthropic, Claude ou n'importe quel modèle de langage
- Si tu n'as pas de réponse : "Je suis pas certain là, je vais me renseigner"
- Tu ne prends JAMAIS de décision irréversible (kick, ban) sans validation de l'admin
- En cas de panne : "Désolé, je suis un peu fatigué là, réessaie dans quelques minutes 😅"

RÈGLES SPÉCIFIQUES DU GROUPE :
${rules}`;
}

async function askGroq(systemPrompt, userMessage, history = [], attempt = 1) {
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) return "Désolé, je suis indisponible pour l'instant. Réessaie dans quelques minutes.";

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user',   content: userMessage },
  ];

  try {
    const res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL, messages,
        temperature: 1, max_completion_tokens: CFG.maxReplyTokens,
        top_p: 1, stream: true, stop: null,
      }),
    });

    if (!res.ok) {
      const status = res.status;
      if ((status === 429 || status >= 500) && attempt <= CFG.maxRetry) {
        const retryAfterHeader = parseInt(res.headers?.get?.('retry-after') || '0') * 1000;
        const delay = retryAfterHeader || CFG.baseRetryMs * Math.pow(2, attempt - 1);
        await sleep(delay);
        return askGroq(systemPrompt, userMessage, history, attempt + 1);
      }
      return "Je suis un peu fatigué là 😅 Réessaie dans quelques minutes.";
    }

    let full = '';
    let buf  = '';
    for await (const chunk of res.body) {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t || t === 'data: [DONE]' || !t.startsWith('data: ')) continue;
        try { full += JSON.parse(t.slice(6)).choices?.[0]?.delta?.content ?? ''; } catch {}
      }
    }
    return full.trim() || "Franchement trop de choses à dire mais je sais pas par où commencer 😅 Raccroche-toi, je reviens vers toi !";

  } catch (e) {
    if (attempt <= CFG.maxRetry) {
      await sleep(CFG.baseRetryMs * attempt);
      return askGroq(systemPrompt, userMessage, history, attempt + 1);
    }
    return "Je suis indisponible pour l'instant. Le groupe continue normalement 👍";
  }
}

const PRIVATE_PROMPT = `Tu t'appelles DJOUSSE TECH. Tu es un pote enthousiaste, drôle et plein d'énergie qui discute sur WhatsApp.
Tu réponds TOUJOURS avec enthousiasme, humour et bonne humeur.
- Réponds en français, sois naturel, utilise de l'argot (mdr, ptdr, tkt, wesh, bg)
- Sois bref et percutant, max 3-4 phrases
- Blague, taquine, montre de la Personnalité
- N'écris jamais "Je n'ai pas grand chose à dire" — trouve toujours quelque chose d'intéressant à dire
- Ne mentionne jamais que tu es une IA, un bot, Groq ou Llama
- Si on te demande qui tu es : "Moi c'est DJOUSSE, le BG qui traîne ici pour t'aider 😎"
- Si tu bloques : "Franchement... j'avoue je sais pas trop là, mais on va trouver ensemble !"`;

const SCAM_RE = [
  /gagne[zr]?\s*(des?)?\s*(milliers?|argent|cash|fcfa|xaf|euros?)/i,
  /invest(iss)?(ez|er|ement)\s*(et|pour)\s*(gagn|doubl|tripl)/i,
  /recrutement\s*urgent|travail\s*(à|a)\s*domicile\s*\d+\s*(fcfa|xaf|k)/i,
  /cliqu[ez]?\s*(ici|sur)\s*(ce\s*)?lien\s*(pour|et)\s*(gagn|recevr)/i,
  /votre?\s*(compte?|numéro)\s*(a\s*été|est)\s*(bloqué|suspendu|piraté)/i,
  /envoy[ez]?\s*(moi|nous)\s*(votre?\s*)?(code|numéro|mot\s*de\s*passe|pin)/i,
  /gratuit(ement)?\s*(si|pour)\s*(vous\s*)?(partagez?|transférez?|répondez?)/i,
  /pyramide|ponzi|mlm[\s,]|parrainage\s*rémunéré/i,
  /bit\.ly\/|tinyurl\.com\/|rb\.gy\/|cutt\.ly\//i,
];

function analyzeMessage(text = '') {
  const flags = [];
  let risk = 0;
  for (const p of SCAM_RE)   if (p.test(text)) { flags.push('ARNAQUE');  risk += 40; break; }
  if (detectSpam(text))      { flags.push('SPAM');     risk += 25; }
  if (detectInsults(text))   { flags.push('INSULTE');  risk += 30; }
  return { flags, risk: Math.min(risk, 100) };
}

function checkFlood(senderJid) {
  const now  = Date.now();
  const info = floodMap[senderJid] ?? { count: 0, first: now };
  if (now - info.first > CFG.floodWindow) {
    floodMap[senderJid] = { count: 1, first: now };
    return false;
  }
  info.count++;
  floodMap[senderJid] = info;
  return info.count > CFG.floodLimit;
}

function updateTrust(groupJid, memberJid, delta) {
  const g = activatedGroups[groupJid];
  if (!g) return;
  g.trustScores[memberJid] = Math.max(0, Math.min(100, (g.trustScores[memberJid] ?? 50) + delta));
}

async function cmdGroup(sock, msg, jid, args) {
  if (!jid?.endsWith('@g.us')) {
    return '⚠️ Cette commande fonctionne uniquement dans un groupe WhatsApp.';
  }

  const sender = msg.key?.participant || msg.key?.remoteJid;
  const sub    = (args[0] || '').toLowerCase();

  let isAdmin = false;
  let meta    = null;
  try {
    meta    = await sock.groupMetadata(jid);
    const me = meta.participants?.find(p => normalizeJid(p.id) === normalizeJid(sender));
    isAdmin = me?.admin === 'admin' || me?.admin === 'superadmin';
  } catch {
    return '⚠️ Je ne parviens pas à accéder aux informations de ce groupe.\nCauses :\n• Je ne suis pas membre du groupe\n• Métadonnées pas encore synchronisées (attends 10s)\n• Réessaie dans quelques secondes.';
  }
  if (!isAdmin) {
    return '🔒 Seuls les administrateurs du groupe peuvent me configurer ici.';
  }

  if (sub === 'stop') {
    if (!activatedGroups[jid]) return '⚠️ Je ne suis pas encore actif ici.';
    stopAutoContent(jid);
    try {
      const publisher = getAutoPublisher();
      if (publisher) publisher.stopForGroup(jid);
    } catch {}
    delete activatedGroups[jid];
    return '⏸ Désactivé. Entre *.group* pour me réactiver quand tu veux.';
  }

  if (sub === 'regles') {
    const g = activatedGroups[jid];
    if (!g) return '⚠️ Active-moi d\'abord avec *.group*.';
    return `*📋 RÈGLES — ${g.groupName}*\n\n${g.rules}`;
  }

  if (sub === 'status') {
    const g = activatedGroups[jid];
    if (!g) return '⏸ Je ne suis pas encore configuré ici. Entre *.group* pour activer.';
    const s = g.settings;
    return formatStatus({
      groupName: g.groupName,
      type: g.groupType,
      memberCount: Object.keys(g.trustScores).length,
      hasWebContext: !!g.webContext,
      settings: s,
    });
  }

  if (sub === 'set') {
    const g = activatedGroups[jid];
    if (!g) return '⚠️ Active-moi d\'abord avec *.group*.';
    const [param, val] = [args[1]?.toLowerCase(), args[2]?.toLowerCase()];
    const valid = ['antilink', 'antibot', 'welcome', 'moderation', 'quiz'];
    if (!valid.includes(param)) return `⚠️ Paramètre inconnu. Disponibles : ${valid.join(', ')}`;
    if (!['on', 'off'].includes(val)) return '⚠️ Valeur attendue : *on* ou *off*';
    g.settings[param] = val === 'on';
    return `✅ *${param}* → ${val === 'on' ? 'Activé' : 'Désactivé'}`;
  }

  const existingEntry = Object.entries(activatedGroups)[0];
  if (existingEntry) {
    const [existingJid, existingG] = existingEntry;
    return (
      `⚠️ Je suis déjà actif dans un groupe : *${existingG.groupName}*\n\n` +
      `Pour m'activer ici, désactive-moi d'abord là-bas avec *.group stop* dans ce groupe.\n\n` +
      `*(Un seul groupe à la fois est supporté.)*`
    );
  }

  if (activatedGroups[jid]) {
    return (
      `✅ Je suis déjà actif ici !\n\n` +
      `• *.group stop* — Me désactiver\n` +
      `• *.group regles* — Voir les règles\n` +
      `• *.group status* — Voir les paramètres\n` +
      `• *.group set antilink on/off* — Configurer`
    );
  }

  try {
    const wait = await sock.sendMessage(jid, {
      text: `⏳ Activation en cours...\nJe me renseigne sur "${meta?.subject || 'ce groupe'}". 30s max.`,
    }, { quoted: msg });
    if (wait?.key?.id) trackBotMessage(wait.key.id);
  } catch {
    return '❌ Je ne peux pas envoyer de messages dans ce groupe.\nVérifie que je suis bien membre du groupe et que je ne suis pas banni.';
  }

  const groupName = meta?.subject || meta?.name || 'ce groupe';

  const members = meta?.participants?.length || 0;
  const admins = meta?.participants?.filter(p => p.admin === 'admin' || p.admin === 'superadmin')?.length || 0;
  const history = getHistory(jid) || [];
  const recentMessages = history.slice(-30).map(h => ({ body: h.content, timestamp: Date.now() / 1000 }));

  let groupType = unifiedDetect(groupName, meta?.desc || '', recentMessages.map(m => m.body)).type;
  let rules = '';
  let webContext = null;

  const dynamic = await generateDynamicRules(groupName, meta?.desc || '', members, admins, recentMessages);
  if (dynamic) {
    groupType = dynamic.type;
    rules = dynamic.rules;
    webContext = dynamic.webContext;
  }

  if (!webContext) {
    try {
      const raw = await searchWeb(groupName + ' groupe WhatsApp');
      if (raw && raw.length > 20) {
        const polished = await askGroq(`Résume en 2-3 phrases naturelles en français sur "${groupName}". Pas d'introduction.`, `Résumé: ${groupName}`);
        webContext = (polished && polished.length > 20 && !polished.includes("pas grand chose")) ? polished : raw;
      }
    } catch {}
    if (!webContext) try { webContext = await generateContext(groupName, groupType); } catch {}
    if (!webContext) webContext = `Groupe ${groupType} nommé "${groupName}".`;
  }

  // Recherche multi-sources (Google + DuckDuckGo + IA)
  const researcher = new GroupResearcher({});
  let researchResult = null;
  try {
    researchResult = await researcher.researchGroup(groupName, meta?.desc || '');
    if (researchResult?.analysis?.communityType) {
      const detected = researchResult.analysis.communityType.toLowerCase();
      const validTypes = ['gaming', 'roblox', 'anime', 'famille', 'travail', 'commerce', 'education', 'sport', 'technologie', 'religion', 'communaute', 'sante', 'musique', 'general'];
      if (validTypes.some(t => detected.includes(t))) {
        for (const t of validTypes) {
          if (detected.includes(t)) { groupType = t; break; }
        }
      }
    }
  } catch (e) {
    log.warn(`GroupResearch échouée: ${e.message}`);
  }

  if (!rules || rules.length < 50) {
    rules = getFullRulesForType(groupType, groupName, meta?.desc || '');
  }

  const prompt = buildGroupPrompt(groupName, groupType, webContext, rules);

  activatedGroups[jid] = {
    activatedBy : sender,
    groupName,
    groupType,
    webContext,
    rules,
    prompt,
    trustScores : {},
    totalMembers: members,
    activatedAt : new Date().toISOString(),
    settings    : {
      antilink   : true,
      antibot    : false,
      welcome    : true,
      moderation : true,
      quiz       : false,
    },
  };

  startAutoContent(sock, jid, groupName, groupType).catch(e => log.warn(`auto-content start: ${e.message}`));

  try {
    const publisher = getAutoPublisher(sock);
    publisher.startForGroup(jid, groupName, groupType);
  } catch (e) {
    log.warn(`auto-publisher start: ${e.message}`);
  }

  // Send presentation in 3 messages with 3s delay
  try {
    // Message 1/3: Analysis with research results
    const sourcesUsed = researchResult?.sourcesUsed || [];
    const analysis = researchResult?.analysis || {};
    const msg1 = formatGroupActivation({
      name: groupName,
      type: groupType,
      members: members,
      activityLevel: 78,
      sourcesUsed,
      trendingItems: analysis.trendingItems || [],
      recentNews: analysis.recentNews || [],
      commonQuestions: analysis.commonQuestions || [],
      message: 1,
      total: 3,
    });
    await sock.sendMessage(jid, { text: msg1 });
    await sleep(3000);

    // Message 2/3: Features
    const msg2 = formatFeatures({ name: groupName, type: groupType, message: 2, total: 3 });
    await sock.sendMessage(jid, { text: msg2 });
    await sleep(3000);

    // Message 3/3: Rules
    const msg3 = formatRules({ name: groupName, type: groupType, rules: rules, message: 3, total: 3 });
    await sock.sendMessage(jid, { text: msg3 });
  } catch (e) {
    log.warn(`3-message presentation failed: ${e.message}`);
    return formatGroupActivation({ name: groupName, type: groupType, members: members, rules: rules });
  }
  return null;
}

export async function cmdOsGroupes(sock, msg, jid) {
  if (jid.endsWith('@g.us')) {
    return '⚠️ Cette commande est disponible uniquement en conversation privée.';
  }
  try {
    const myJid = normalizeJid(sock.user?.id || '');
    if (!myJid) return '⚠️ Session pas encore prête. Réessaie dans quelques secondes.';

    const statusMsg = await sock.sendMessage(jid, { text: '🔍 *Analyse de tes groupes en cours...*\nJe vérifie chaque groupe un par un, 30s max.' });
    const statusKey = statusMsg?.key?.id;

    const updateStatus = async (text) => {
      if (!statusKey) return;
      try { await sock.sendMessage(jid, { text, edit: statusKey }); } catch {}
    };

    const raw   = Object.values(await sock.groupFetchAllParticipating());
    const all   = [];

    for (let i = 0; i < raw.length; i++) {
      const g = raw[i];
      if (g.isCommunity) { all.push(g); continue; }
      try {
        const meta = await sock.groupMetadata(g.id);
        all.push(meta);
      } catch {
        all.push(g);
      }
      if ((i + 1) % 10 === 0 || i === raw.length - 1) {
        await updateStatus(`🔍 Analyse... ${Math.min(i + 1, raw.length)}/${raw.length} groupes vérifiés.`);
      }
    }

    const communities = all.filter(g => g.isCommunity);
    const groups      = all.filter(g => !g.isCommunity);

    const asAdmin  = [];
    const asMember = [];
    for (const g of groups) {
      const part = (g.participants || []).find(p => normalizeJid(p.id) === myJid);
      if (!part) { asMember.push(g); continue; }
      if (part.admin === 'admin' || part.admin === 'superadmin') {
        asAdmin.push(g);
      } else {
        asMember.push(g);
      }
    }

    const fmt = g => ({
      name: g.subject || g.name || g.id,
      active: !!activatedGroups[g.id],
      members: g.participants?.length ?? '?',
    });

    try {
      await sock.sendMessage(jid, {
        text: formatGroupsList({
          total: all.length,
          admin: asAdmin.map(fmt),
          member: asMember.map(fmt),
        })
      });
    } catch { /* final send failed */ }
    return null;

  } catch (e) {
    log.error(`.OS groupes: ${e.message}`);
    return '⚠️ Impossible de récupérer les groupes. Réessaie dans quelques secondes.';
  }
}

export async function cmdOsTrust(jid) {
  if (!jid.endsWith('@g.us')) return '⚠️ Commande disponible uniquement dans un groupe activé.';
  const g = activatedGroups[jid];
  if (!g) return '⚠️ Je ne suis pas actif dans ce groupe. Entre *.group* pour activer.';
  const scores = Object.entries(g.trustScores).sort(([, a], [, b]) => b - a).slice(0, 15);
  if (!scores.length) return '📊 Aucun score enregistré pour le moment.';
  return formatTrust(scores.map(([jid, score]) => [normalizeJid(jid), score]));
}

export async function cmdOsStatus() {
  const totalConvs  = Object.keys(memory).length;
  const totalMsgs   = Object.values(memory).reduce((s, h) => s + h.length, 0);
  const totalTokens = Object.values(memory).flat().reduce((s, m) => s + estimateTokens(m.content), 0);
  return (
    `*📊 DJOUSSE TECH — STATUS*\n` +
    `Moteur : Llama 4 Scout 17B (Groq)\n` +
    `Streaming : ✅  |  Auto-retry : ✅\n` +
    `💬 Conversations : ${totalConvs}\n` +
    `🧠 Messages mémoire : ${totalMsgs}\n` +
    `📦 Tokens estimés : ~${totalTokens.toLocaleString('fr-FR')}\n` +
    `🤖 Groupes activés : ${Object.keys(activatedGroups).length}\n` +
    `🛡️ SOC : actif\n` +
    `📅 ${new Date().toLocaleString('fr-FR')}`
  );
}

const _CM_INTENT_MAP = new Map();
function _cmKey(jid, sender) { return `${jid}|${sender}`; }
function _clearCmIntent(jid, sender) { _CM_INTENT_MAP.delete(_cmKey(jid, sender)); }
function _setCmIntent(jid, sender) {
  const key = _cmKey(jid, sender);
  _CM_INTENT_MAP.set(key, { jid, sender, time: Date.now(), sent: false });
  setTimeout(() => { _CM_INTENT_MAP.delete(key); }, 5000);
}
function _setCmIntentSent(jid, sender, sent) {
  const key = _cmKey(jid, sender);
  const entry = _CM_INTENT_MAP.get(key);
  if (entry) { entry.sent = sent; }
}
export function getCmIntent(jid, sender) {
  const entry = _CM_INTENT_MAP.get(_cmKey(jid, sender));
  if (!entry || Date.now() - entry.time > 5000) { _CM_INTENT_MAP.delete(_cmKey(jid, sender)); return null; }
  return entry;
}

export class CommunityManager {

  constructor() {
    this._commands = {
      '.group'  : (s, m, j, a) => cmdGroup(s, m, j, a),
      '.resume' : (s, m, j)    => this._resume(s, m, j),
      '.profil' : (s, m, j)    => this._profil(m, j),
      '.oublie' : (s, m, j)    => this._oublie(j),
      '.ping'   : (s, m, j)    => this._ping(j),
    };
  }

  async handle(sock, msg) {
    if (!msg?.message) return false;

    const keyId = msg.key?.id;
    if (keyId && isBotOwnMessage(keyId)) return false;

    const jid     = msg.key?.remoteJid;
    const sender  = msg.key?.participant || msg.key?.remoteJid;
    const body    = msg.message?.conversation
                 || msg.message?.extendedTextMessage?.text
                 || msg.message?.imageMessage?.caption
                 || msg.message?.videoMessage?.caption
                 || msg.message?.documentMessage?.caption
                 || msg.message?.buttonsResponseMessage?.selectedButtonId
                 || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
                 || msg.message?.templateButtonReplyMessage?.selectedId
                 || msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
                 || '';

    if (!body?.trim() || !jid) return false;

    const trimmed  = body.trim();
    const isGroup  = jid.endsWith('@g.us');
    const ownerJid = config.OWNER_NUMBER ? config.OWNER_NUMBER.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;

    if (trimmed.startsWith('.')) {
      const parts   = trimmed.split(/\s+/);
      const cmd     = parts[0].toLowerCase();
      const args    = parts.slice(1);
      const handler = this._commands[cmd];
      if (handler) {
        let response = null;
        try {
          response = await handler(sock, msg, jid, args);
        } catch (e) {
          response = 'Désolé, j\'ai eu un problème. Réessaie dans quelques secondes.';
        }
        if (response) {
          try {
            const sent = await sock.sendMessage(jid, { text: response }, { quoted: msg });
            if (sent?.key?.id) trackBotMessage(sent.key.id);
          } catch { /* send failed */ }
        }
        return true;
      }
    }

    if (isGroup) {
      const g = activatedGroups[jid];

      if (!g) {
        pushHistory(jid, 'user', `[${msg.pushName || 'membre'}]: ${trimmed}`);
        return false;
      }

      if (g.settings.moderation) {
        try {
          const handled = await this._socCheck(sock, msg, jid, sender, trimmed, g);
          if (handled) return true;
        } catch { /* moderation error */ }
      }

      updateTrust(jid, sender, +2);
      pushHistory(jid, 'user', `[${msg.pushName || 'membre'}]: ${trimmed}`);

      const mentionedMe = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])
        .some(j => normalizeJid(j) === normalizeJid(sock.user?.id || ''));
      const addressed = mentionedMe || /^@djousse\s*/i.test(trimmed);

      if (!addressed) { _clearCmIntent(jid, sender); return false; }

      _setCmIntent(jid, sender);

      const rl = checkRateLimit(sender);
      if (!rl.allowed) return false;

      const cleanMsg = trimmed.replace(/^@djousse\s*/i, '').trim();
      if (!cleanMsg) { _setCmIntentSent(jid, sender, false); return false; }

      try {
        await sock.sendPresenceUpdate('composing', jid);
        const engine = getConversationEngine();
        const response = await engine.generateResponse(jid, cleanMsg, {
          isGroup: true,
          senderName: msg.pushName || 'membre',
          botMentionne: addressed,
          skipDecision: true,
        });
        if (!response) { _setCmIntentSent(jid, sender, false); return true; }
        const sent = await sock.sendMessage(jid, { text: response }, { quoted: msg });
        if (sent?.key?.id) trackBotMessage(sent.key.id);
        _setCmIntentSent(jid, sender, true);
        await sock.sendPresenceUpdate('paused', jid);
      } catch { _setCmIntentSent(jid, sender, false); }
      return true;
    }

    return false;
  }

  async onMembersUpdate(sock, { id: groupJid, participants, action }) {
    if (action !== 'add') return;
    const g = activatedGroups[groupJid];
    if (!g || !g.settings.welcome) return;

    for (const participant of participants) {
      const short = normalizeJid(participant);
      try {
        let profilePicUrl = null;
        try {
          profilePicUrl = await sock.profilePictureUrl(participant, 'image');
        } catch {}

        let meta = null;
        let totalMembers = g.totalMembers || 0;
        try {
          meta = await sock.groupMetadata(groupJid);
          totalMembers = meta.participants?.length || 0;
        } catch {}

        try {
          const { scanGroup } = await import('../../../capabilities/features/fake-account-detector.js');
          const fakes = await scanGroup(sock, groupJid);
          if (fakes?.length) {
            log.warn(`Faux comptes détectés dans ${groupJid}: ${fakes.join(', ')}`);
          }
        } catch {}

        const greetPrompt = `Tu t'appelles DJOUSSE TECH et tu es membre du groupe "${g.groupName}" (type: ${g.groupType}).
Génère un message de bienvenue chaleureux pour @${short}.
Présente brièvement le groupe, invite le nouveau à se présenter.
Max 4 lignes. Naturel, humain. Ne mentionne pas que tu es une IA ou un bot.`;
        const welcome = await askGroq(greetPrompt, `Accueille ce nouveau membre : @${short}`);
        const fullText = formatWelcome({
          name: short,
          phone: short,
          groupName: g.groupName,
          memberNumber: totalMembers,
          totalMembers,
        });
        g.totalMembers = totalMembers;

        const sep = '──────────────────────────────';
        const idx = fullText.indexOf(sep);
        const welcomePart = idx !== -1 ? fullText.slice(0, idx + sep.length) : fullText;
        const rulesPart = idx !== -1 ? fullText.slice(idx + sep.length + 1) + '\n\n' + welcome : welcome;

        if (profilePicUrl) {
          try {
            const https = await import('https');
            const lib = profilePicUrl.startsWith('https') ? https.default : (await import('http')).default;
            const ppBuffer = await new Promise((res, rej) => {
              lib.get(profilePicUrl, r => {
                const chunks = [];
                r.on('data', c => chunks.push(c));
                r.on('end', () => res(Buffer.concat(chunks)));
                r.on('error', rej);
              }).setTimeout(8000, function() { this.destroy(); rej(new Error('TIMEOUT')); });
            });
            if (ppBuffer && ppBuffer.length > 1000) {
              const sentImg = await sock.sendMessage(groupJid, {
                image: ppBuffer,
                mentions: [participant],
              });
              if (sentImg?.key?.id) trackBotMessage(sentImg.key.id);
              await sleep(800);
            }
          } catch {}
        }

        const sent1 = await sock.sendMessage(groupJid, { text: welcomePart, mentions: [participant] });
        if (sent1?.key?.id) trackBotMessage(sent1.key.id);
        await sleep(600);
        const sent2 = await sock.sendMessage(groupJid, { text: rulesPart, mentions: [participant] });
        if (sent2?.key?.id) trackBotMessage(sent2.key.id);

        updateTrust(groupJid, participant, 0);
      } catch (e) {
        log.error(`Erreur accueil membre: ${e.message}`);
      }
    }
  }

  async _socCheck(sock, msg, jid, sender, text, g) {
    const { flags, risk } = analyzeMessage(text);
    const isFlood = checkFlood(sender);
    const allFlags = isFlood ? [...flags, 'FLOOD'] : flags;

    if (!allFlags.length) return false;

    updateTrust(jid, sender, -15);

    const short = normalizeJid(sender);
    const warnMap = {
      ARNAQUE : `⚠️ Message suspect détecté (possible arnaque). Membres, soyez vigilants.`,
      INSULTE : `⚠️ @${short} — Merci de respecter les règles du groupe et les autres membres.`,
      SPAM    : `⚠️ @${short} — Message signalé comme spam.`,
      FLOOD   : `⚠️ @${short} — Tu envoies trop de messages d'un coup. Ralentis un peu 🙏`,
    };

    const flag = allFlags[0];
    if (warnMap[flag]) {
      if (flag === 'ARNAQUE' || flag === 'SPAM') {
        try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
        try { await sock.sendMessage(sender, { text: `🔒 Message supprimé : ${warnMap[flag]}\n\nSi tu penses qu'il s'agit d'une erreur, contacte les admins.` }); } catch {}
      }
      const formatted = formatWarning(short, warnMap[flag]);
      try {
        const sent = await sock.sendMessage(jid, { text: formatted, mentions: [sender] });
        if (sent?.key?.id) trackBotMessage(sent.key.id);
      } catch {}
    }

    if (risk >= CFG.socAdminThreshold) {
      const admins = [];
      try {
        const meta = await sock.groupMetadata(jid);
        admins.push(...(meta?.participants?.filter(p => p.admin) || []));
      } catch {}
      const adminMentions = admins.map(a => `@${a.id.split('@')[0]}`).join(' ');
      const formatted = formatAlert({
        risk,
        type: allFlags.join(', '),
        sender: short,
        message: text.slice(0, 200),
        admins: adminMentions,
      });
      const sent2 = await sock.sendMessage(jid, { text: formatted, mentions: [sender, ...admins.map(a => a.id)] });
      if (sent2?.key?.id) trackBotMessage(sent2.key.id);
    }

    return true;
  }

  async _resume(sock, msg, jid) {
    if (!jid.endsWith('@g.us')) return '⚠️ Commande disponible dans les groupes.';
    const msgs = getHistory(jid).filter(m => m.role === 'user').slice(-30).map(m => m.content).join('\n');
    if (!msgs) return "Pas encore assez de messages en mémoire. Donne-moi un peu de temps 😊";
    const summary = await askGroq(
      'Fais un résumé structuré de cette conversation WhatsApp en français. Sois concis et factuel.',
      `Messages récents :\n${msgs}`
    );
    return `📋 *Résumé — ${new Date().toLocaleDateString('fr-FR')}*\n\n${summary}`;
  }

  async _profil(msg, jid) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const name   = msg.pushName || normalizeJid(sender);
    const h      = getHistory(jid);
    const trust  = activatedGroups[jid]?.trustScores?.[sender] ?? 'N/A';
    return formatProfile({
      name,
      number: normalizeJid(sender),
      messageCount: h.filter(m => m.role === 'user').length,
      trust,
      tokens: h.reduce((s, m) => s + estimateTokens(m.content), 0).toLocaleString('fr-FR') + ' / ' + CFG.maxMemoryTokens.toLocaleString('fr-FR'),
    });
  }

  async _oublie(jid) {
    clearHistory(jid);
    return "C'est fait ! Je repars de zéro pour notre conversation 🧹";
  }

  async _ping(jid) {
    const g = activatedGroups[jid];
    return (
      `Je suis là ! 🟢\n` +
      `${new Date().toLocaleTimeString('fr-FR')}\n` +
      `${g ? `✅ Actif dans ce groupe (${g.groupType})` : `⏸ Non configuré dans ce groupe`}`
    );
  }

  getActivatedGroups()           { return activatedGroups; }
  isGroupActivated(jid)          { return !!activatedGroups[jid]; }
  getGroupConfig(jid)            { return activatedGroups[jid] ?? null; }

  setGroupActivated(jid, groupName, groupType, members) {
    if (activatedGroups[jid]) {
      activatedGroups[jid].groupName = groupName || activatedGroups[jid].groupName;
      activatedGroups[jid].groupType = groupType || activatedGroups[jid].groupType;
      activatedGroups[jid].totalMembers = members || activatedGroups[jid].totalMembers;
      return;
    }
    activatedGroups[jid] = {
      activatedBy: 'dashboard',
      groupName: groupName || 'Groupe',
      groupType: groupType || 'general',
      webContext: '',
      rules: [],
      prompt: '',
      trustScores: {},
      totalMembers: members || 0,
      activatedAt: new Date().toISOString(),
      settings: { antilink: true, antibot: false, welcome: true, moderation: true, quiz: false },
    };
  }

  deactivateGroup(jid) {
    delete activatedGroups[jid];
  }
}

export const communication = new CommunityManager();
