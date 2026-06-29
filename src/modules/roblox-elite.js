import https from 'https';
import http from 'http';
import { getSetting, updateSetting, rawRun, rawGet, rawAll } from '../lib/database.js';
import logger from '../core/logger.js';

const log = {
  info:  (...a) => logger.info(`[Roblox] ${a[0]}`, ...a.slice(1)),
  warn:  (...a) => logger.warn(`[Roblox] ${a[0]}`, ...a.slice(1)),
  error: (...a) => logger.error(`[Roblox] ${a[0]}`, ...a.slice(1)),
  debug: (...a) => logger.debug(`[Roblox] ${a[0]}`, ...a.slice(1)),
};

const CFG = {
  GROUP_KEY          : 'roblox_group_jid',
  MODE_KEY           : 'roblox_mode',
  INTERVAL_MIN       : 25,
  INTERVAL_MAX       : 45,
  SILENCE_AFTER_POST : 8 * 60_000,
  SILENCE_AFTER_REPLY: 3 * 60_000,
  SILENCE_ACTIVITY   : 90_000,
  CONV_MEMORY_SIZE   : 10,
  MAX_CAPTION_LEN    : 900,
  REPLY_CHANCE_BASE  : 0.55,
  PEAK_HOURS         : [7,8,9,12,13,14,17,18,19,20,21,22],
  CONTENT_TYPES      : ['trending','tip','versus','secret','event','spotlight'],
};

const state = {
  silenceUntil    : 0,
  autoPostTimer   : null,
  isPosting       : false,
  postQueue       : [],
  isProcessingQ   : false,
  lastGroupActivity: 0,
  activityCount   : 0,
  activityWindow  : [],
  lastContentType : null,
  sessionPosted   : new Set(),
};

async function robustFetch(url, { retries = 3, timeout = 12_000, method = 'GET', body } = {}) {
  const lib = url.startsWith('https') ? https : http;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
          hostname: parsed.hostname,
          path    : parsed.pathname + parsed.search,
          method,
          headers : {
            'User-Agent'  : 'Mozilla/5.0 (compatible; DJousseTechBot/3.0)',
            'Accept'      : 'application/json',
            'Content-Type': 'application/json',
          },
          timeout,
        };
        const req = lib.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(data)); }
              catch { reject(new Error(`JSON invalide (${res.statusCode})`)); }
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
        req.on('error',   (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
      return result;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.min(1000 * 2 ** attempt, 8000);
      log.warn(`Retry ${attempt}/${retries} pour ${url.slice(0, 60)} (${err.message}) — attente ${wait}ms`);
      await sleep(wait);
    }
  }
}

async function fetchBuffer(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, { headers: { 'User-Agent': 'DJousseTechBot/3.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject).setTimeout(15_000, function() { this.destroy(); reject(new Error('TIMEOUT')); });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function isInSilence()           { return Date.now() < state.silenceUntil; }
export function setSilence(ms)          { state.silenceUntil = Date.now() + ms; }
export function clearSilence()          { state.silenceUntil = 0; }

export function isRobloxGroup(chat)     { return getSetting(CFG.GROUP_KEY) === chat; }
export function isRobloxEnabled()       { return getSetting(CFG.MODE_KEY) === 'on'; }
export function setRobloxGroup(jid)     { updateSetting(CFG.GROUP_KEY, jid); }
export function setRobloxEnabled(val)   { updateSetting(CFG.MODE_KEY, val ? 'on' : 'off'); }

export function recordActivity() {
  const now = Date.now();
  state.lastGroupActivity = now;
  state.activityWindow    = state.activityWindow.filter(t => now - t < 60_000);
  state.activityWindow.push(now);
  state.activityCount     = state.activityWindow.length;
}

function isGroupVeryActive() {
  return state.activityCount > 5;
}

function hasBeenPosted(gameId) {
  if (state.sessionPosted.has(String(gameId))) return true;
  try {
    const r = rawGet('SELECT 1 FROM roblox_posted WHERE game_id=?', String(gameId));
    return !!r;
  } catch { return false; }
}

function markAsPosted(gameId) {
  state.sessionPosted.add(String(gameId));
  try {
    rawRun('INSERT OR IGNORE INTO roblox_posted (game_id) VALUES (?)', String(gameId));
    rawRun("DELETE FROM roblox_posted WHERE posted_at < datetime('now', '-7 days')");
  } catch {}
}

function getConvHistory(chatJid) {
  try {
    return rawAll(`
      SELECT role, content FROM roblox_conv
      WHERE chat_jid = ? ORDER BY created_at ASC LIMIT ${CFG.CONV_MEMORY_SIZE}
    `, chatJid);
  } catch { return []; }
}

function saveToHistory(chatJid, role, content) {
  try {
    rawRun('INSERT INTO roblox_conv (chat_jid, role, content) VALUES (?, ?, ?)', chatJid, role, content.slice(0, 500));
    rawRun(`
      DELETE FROM roblox_conv WHERE chat_jid = ? AND id NOT IN (
        SELECT id FROM roblox_conv WHERE chat_jid = ? ORDER BY created_at DESC LIMIT ${CFG.CONV_MEMORY_SIZE * 2}
      )
    `, chatJid, chatJid);
  } catch {}
}

async function fetchTrendingGames(limit = 20) {
  try {
    const data = await robustFetch('https://api.rolimons.com/games/v1/gamelist', { timeout: 10_000 });
    const games = data?.games;
    if (games && Object.keys(games).length > 0) {
      return Object.entries(games)
        .map(([id, info]) => ({ id, name: info[0], players: info[1] ?? 0 }))
        .filter(g => g.players > 0)
        .sort((a, b) => b.players - a.players)
        .slice(0, limit);
    }
  } catch (e) { log.warn(`Rolimons indisponible : ${e.message}`); }

  try {
    const data = await robustFetch(
      'https://games.roblox.com/v1/games/list?sortToken=&gameFilter=default&startRows=0&maxRows=20&keyword=',
      { timeout: 10_000 }
    );
    if (data?.games?.length) {
      return data.games.map(g => ({
        id   : String(g.universeId || g.placeId),
        name : g.name,
        players: g.playerCount ?? 0,
      }));
    }
  } catch (e) { log.warn(`API Roblox officielle indisponible : ${e.message}`); }
  return [];
}

async function fetchGameDetails(universeId) {
  try {
    const data = await robustFetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    return data?.data?.[0] ?? null;
  } catch { return null; }
}

async function fetchGameThumbnail(universeId) {
  try {
    const data = await robustFetch(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&size=768x432&format=Png`,
      { timeout: 8_000 }
    );
    const url = data?.data?.[0]?.thumbnails?.[0]?.imageUrl;
    if (url) return url;
  } catch {}

  try {
    const data = await robustFetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png`,
      { timeout: 8_000 }
    );
    const url = data?.data?.[0]?.imageUrl;
    if (url) return url;
  } catch {}

  return '';
}

function detectIntent(text) {
  const t = text.toLowerCase();
  if (/\?|comment|pourquoi|c'est quoi|c est quoi|keskon|c koi|quel|quelle|lequel|laquelle|vous pensez|vous croyez|est[- ]ce que|est ce/.test(t))
    return { type: 'question', replyChance: 0.90, style: 'informatif' };
  if (/!{2,}|🔥|🎮|💥|incroyable|trop bien|c'est fou|légendaire|goat|obby|noob|ez|gg|lol|mdr|ptdr|😂|😭|🤣/.test(t))
    return { type: 'hype', replyChance: 0.65, style: 'enthousiaste' };
  if (/meilleur|pire|préfère|prefer|mieux|bof|nul|moyen|overrated|underrated|vs|versus|ou bien|ou plutôt/.test(t))
    return { type: 'debate', replyChance: 0.75, style: 'opinion_tranchée' };
  if (/roblox\.com\/games|roblox\.com\/groups|rbx\.gg/.test(t))
    return { type: 'share', replyChance: 0.80, style: 'curieux' };
  if (/bot|admin|@/.test(t))
    return { type: 'mention', replyChance: 0.95, style: 'direct' };
  if (text.trim().length < 15)
    return { type: 'casual', replyChance: 0.20, style: 'bref' };
  return { type: 'general', replyChance: CFG.REPLY_CHANCE_BASE, style: 'naturel' };
}

const PERSONAS = [
  { name: 'Passionné',   tone: 'Tu es passionné et enthousiaste. Tu fais des références précises aux mécaniques de jeu.' },
  { name: 'Expert',      tone: 'Tu es un joueur expert et analytique. Tu donnes des conseils techniques pertinents.' },
  { name: 'Casuel',      tone: 'Tu es détendu et fun. Tu fais des blagues légères et parles comme un vrai joueur.' },
  { name: 'Découvreur',  tone: 'Tu es curieux et partages toujours un détail surprenant ou peu connu.' },
];
let lastPersonaIdx = -1;

function getPersona() {
  let idx;
  do { idx = Math.floor(Math.random() * PERSONAS.length); } while (idx === lastPersonaIdx);
  lastPersonaIdx = idx;
  return PERSONAS[idx];
}

export async function handleConversation(sock, m, chat, body, pushName, sender) {
  if (isInSilence()) return;
  if (isGroupVeryActive()) {
    if (Math.random() > 0.30) return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const intent = detectIntent(body);
  const roll   = Math.random();

  if (roll > intent.replyChance) {
    log.debug(`Intent "${intent.type}" — pas de réponse (roll ${roll.toFixed(2)} > ${intent.replyChance})`);
    return;
  }

  await sleep(1500 + Math.random() * 2500);

  const history   = getConvHistory(chat);
  const persona   = getPersona();
  const userName  = pushName || sender.split('@')[0];

  const systemPrompt = `Tu es un membre actif et passionné d'un groupe WhatsApp dédié à Roblox.
${persona.tone}
RÈGLES ABSOLUES :
- Tu réponds en français, de manière naturelle et courte (1 à 3 phrases max)
- Tu n'utilises JAMAIS de préfixe de commande (pas de . / ! §)
- Tu ne listes jamais de commandes ni de menus
- Tu es un humain, jamais un bot — tu ne le révèles pas
- Tu parles spécifiquement de Roblox (jeux, updates, techniques, communauté)
- Style : ${intent.style}
- Si quelqu'un partage un lien Roblox, tu réagis avec curiosité ou enthousiasme
- Tu utilises des émojis avec parcimonie (1 ou 2 max par réponse)`;

  const messages = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: `${userName} dit : ${body}` }] },
  ];

  try {
    const data = await robustFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method  : 'POST',
        timeout : 15_000,
        retries : 2,
        body    : {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents          : messages,
          generationConfig  : { maxOutputTokens: 180, temperature: 0.85, topP: 0.92 },
        },
      }
    );

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) return;

    const cleanAnswer = answer.slice(0, 600);
    saveToHistory(chat, 'user',      `${userName}: ${body}`);
    saveToHistory(chat, 'assistant', cleanAnswer);

    await sock.sendMessage(chat, { text: cleanAnswer }, { quoted: m.key });
    setSilence(CFG.SILENCE_AFTER_REPLY);

    log.info(`Réponse "${intent.type}" (${persona.name}) → ${userName}`);
  } catch (e) {
    log.error(`handleConversation: ${e.message}`);
  }
}

function pickContentType() {
  const available = CFG.CONTENT_TYPES.filter(t => t !== state.lastContentType);
  const hour      = new Date().getHours();
  if (CFG.PEAK_HOURS.includes(hour)) {
    const priority = ['trending', 'spotlight', 'versus'].filter(t => available.includes(t));
    if (priority.length) {
      const pick = priority[Math.floor(Math.random() * priority.length)];
      state.lastContentType = pick;
      return pick;
    }
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  state.lastContentType = pick;
  return pick;
}

async function generateGameCaption(game, details, contentType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const gameInfo = {
    nom        : details?.name || game.name,
    joueurs    : (game.players || 0).toLocaleString('fr-FR'),
    visites    : details?.visits ? details.visits.toLocaleString('fr-FR') : null,
    description: (details?.description || '').slice(0, 300),
    créateur   : details?.creator?.name || null,
  };

  const styleGuides = {
    trending  : 'Annonce ce jeu comme un événement brûlant. Ton : excitant, urgent, FOMO.',
    tip       : 'Partage UN conseil ou secret peu connu sur ce jeu. Ton : insider, expert.',
    versus    : 'Compare ce jeu à un autre jeu Roblox similaire. Ton : analytique, passionné.',
    secret    : 'Révèle un secret, Easter egg ou feature cachée de ce jeu. Ton : mystérieux.',
    event     : 'Annonce-le comme un événement communautaire à ne pas manquer. Ton : festif.',
    spotlight : 'Mets ce jeu sous les projecteurs avec un angle original. Ton : journalistique.',
  };

  const prompt = `Tu animes un groupe WhatsApp Roblox en français.
Jeu : ${gameInfo.nom}
Joueurs en ce moment : ${gameInfo.joueurs}
${gameInfo.visites ? `Visites totales : ${gameInfo.visites}` : ''}
${gameInfo.description ? `Description originale : ${gameInfo.description}` : ''}
${gameInfo.créateur ? `Créateur : ${gameInfo.créateur}` : ''}

Type de publication : ${contentType}
Style demandé : ${styleGuides[contentType] || styleGuides.trending}

Écris une description WhatsApp percutante de 3 à 5 lignes max.
- Commence par un emoji fort (pas 🎮 qui est trop banal)
- Une accroche puissante et originale
- 1 ou 2 infos clés du jeu (stats ou secret)
- Une phrase qui donne envie de jouer MAINTENANT
- Pas de hashtag, pas de lien (il sera ajouté après)
- Pas de formatage Markdown, seulement du texte WhatsApp (gras avec *mot*)`;

  try {
    const data = await robustFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method : 'POST',
        timeout: 12_000,
        retries: 2,
        body   : {
          contents        : [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 220, temperature: 0.90 },
        },
      }
    );
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e) {
    log.warn(`generateGameCaption: ${e.message}`);
    return null;
  }
}

async function buildCaption(game, details, contentType) {
  const gameLink = `https://www.roblox.com/games/${game.id}`;
  const name     = details?.name || game.name || 'Jeu sans titre';
  const playing  = (game.players || 0).toLocaleString('fr-FR');
  const visits   = details?.visits ? details.visits.toLocaleString('fr-FR') : null;

  const aiCaption = await generateGameCaption(game, details, contentType);
  if (aiCaption) {
    const suffix = `\n\n👥 *${playing}* joueurs en ligne${visits ? ` · 👣 ${visits} visites` : ''}\n🔗 ${gameLink}`;
    return (aiCaption + suffix).slice(0, CFG.MAX_CAPTION_LEN);
  }

  const typeEmojis = { trending:'🔥', tip:'💡', versus:'⚔️', secret:'🕵️', event:'🎉', spotlight:'🌟' };
  const emoji = typeEmojis[contentType] || '🎮';
  let caption = `${emoji} *${name}*\n\n`;
  if (details?.description) caption += `${details.description.slice(0, 200)}\n\n`;
  caption += `👥 *${playing}* joueurs en ligne\n`;
  if (visits) caption += `👣 ${visits} visites\n`;
  caption += `\n🔗 ${gameLink}`;
  return caption.slice(0, CFG.MAX_CAPTION_LEN);
}

async function processQueue(sock, chat) {
  if (state.isProcessingQ || !state.postQueue.length) return;
  state.isProcessingQ = true;
  while (state.postQueue.length > 0) {
    const task = state.postQueue.shift();
    try {
      await task(sock, chat);
      await sleep(3000 + Math.random() * 3000);
    } catch (e) {
      log.error(`processQueue: ${e.message}`);
    }
  }
  state.isProcessingQ = false;
}

function enqueuePost(fn) {
  state.postQueue.push(fn);
}

export async function autoPost(sock, chat) {
  if (state.isPosting) {
    log.debug('autoPost déjà en cours — ignoré');
    return;
  }
  if (isInSilence()) {
    log.debug(`autoPost : silence actif encore ${Math.round((state.silenceUntil - Date.now()) / 1000)}s`);
    return;
  }
  if (isGroupVeryActive()) {
    log.info('Groupe très actif — publication différée');
    return;
  }
  state.isPosting = true;
  try {
    const games = await fetchTrendingGames(40);
    if (!games.length) { log.warn('Aucun jeu récupéré depuis toutes les sources'); return; }
    const fresh = games.filter(g => !hasBeenPosted(g.id));
    if (!fresh.length) { state.sessionPosted.clear(); return; }
    const batchSize = Math.random() > 0.7 ? 2 : 1;
    const toPost    = fresh.slice(0, batchSize);
    const type      = pickContentType();
    for (const game of toPost) {
      enqueuePost(async (sock, chat) => {
        const [details, thumbUrl] = await Promise.all([
          fetchGameDetails(game.id),
          fetchGameThumbnail(game.id),
        ]);
        const caption = await buildCaption(game, details, type);
        markAsPosted(game.id);
        if (thumbUrl) {
          try {
            const img = await fetchBuffer(thumbUrl);
            await sock.sendMessage(chat, { image: img, caption });
          } catch { await sock.sendMessage(chat, { text: caption }); }
        } else { await sock.sendMessage(chat, { text: caption }); }
        log.info(`Publié [${type}] : ${details?.name || game.name} (${(game.players || 0).toLocaleString()} joueurs)`);
      });
    }
    await processQueue(sock, chat);
    setSilence(CFG.SILENCE_AFTER_POST);
  } catch (e) { log.error(`autoPost: ${e.message}`); }
  finally { state.isPosting = false; }
}

function nextIntervalMs() {
  const hour = new Date().getHours();
  const isPeak = CFG.PEAK_HOURS.includes(hour);
  const base   = isPeak ? CFG.INTERVAL_MIN : CFG.INTERVAL_MIN + (CFG.INTERVAL_MAX - CFG.INTERVAL_MIN) * 0.7;
  const jitter = (Math.random() - 0.5) * 0.3 * base;
  return Math.round((base + jitter) * 60_000);
}

let schedulerTimeout = null;

function scheduleNext(sock, chat) {
  if (schedulerTimeout) clearTimeout(schedulerTimeout);
  const delay = nextIntervalMs();
  const nextIn = Math.round(delay / 60_000);
  log.info(`Prochaine publication dans ~${nextIn} min`);
  schedulerTimeout = setTimeout(async () => {
    if (isRobloxEnabled() && isRobloxGroup(chat)) { await autoPost(sock, chat); }
    scheduleNext(sock, chat);
  }, delay);
}

export function startAutoPoster(sock, chat) {
  stopAutoPoster();
  log.info(`AutoPoster démarré pour le groupe : ${chat}`);
  scheduleNext(sock, chat);
}

export function stopAutoPoster() {
  if (schedulerTimeout) { clearTimeout(schedulerTimeout); schedulerTimeout = null; log.info('AutoPoster arrêté'); }
}

const INSULTS_RE = /(connard|putain|merde|bite|encul[ée]|salope|fdp|ntm|tg|ta gueule|batard|bâtard|conne?|conard|abruti|crétin|débile|idiot|stupide)/i;
const SPAM_RE = /(https?:\/\/[^\s]+){3,}/;
const FLOOD_RE = /(.+?)\1{10,}|(.)\2{15,}/;

const RULES_TEXT = `╔══『 *📜 RÈGLES DU GROUPE* 』══╗

1️⃣ *Respect* — Pas d'insultes ni de harcèlement
2️⃣ *Pas de spam* — Pas de pubs, liens en masse
3️⃣ *Roblox uniquement* — Discussions centrées sur Roblox
4️⃣ *Pas de flood* — Évitez les messages répétés
5️⃣ *Aucun partage de données* — Pas d'infos personnelles
6️⃣ *Pas de NSFW* — Contenu adapté à tous ( PEGI 7+ )
7️⃣ *Suivez les admins* — Les décisions des admins sont finales

⚠️ *Sanctions :*
• 1er avertissement → rappel
• 2e avertissement → mute 1h
• 3e avertissement → exclusion définitive

🎮 *Amusez-vous bien et bon jeu à tous !*`;

async function fetchTopGameThumbnail() {
  try {
    const games = await fetchTrendingGames(1);
    if (games.length) {
      return await fetchGameThumbnail(games[0].id);
    }
  } catch {}
  return '';
}

export async function postRules(sock, chat) {
  try {
    const meta = await sock.groupMetadata(chat);
    const allMentions = meta.participants.map(p => p.id);

    let imgBuffer = null;
    const thumbUrl = await fetchTopGameThumbnail();
    if (thumbUrl) {
      try { imgBuffer = await fetchBuffer(thumbUrl); } catch {}
    }

    const msg = `🏛️ *RÈGLES OFFICIELLES DU GROUPE*\n\n${RULES_TEXT}\n\n📢 ${allMentions.map(j => `@${j.split('@')[0]}`).join(' ')}`;

    if (imgBuffer) {
      await sock.sendMessage(chat, { image: imgBuffer, caption: msg, mentions: allMentions });
    } else {
      await sock.sendMessage(chat, { text: msg, mentions: allMentions });
    }
    log.info(`Règles postées dans ${chat} (${allMentions.length} membres)`);
  } catch (e) {
    log.error(`postRules: ${e.message}`);
  }
}

export async function sendGreeting(sock, chat) {
  try {
    const meta = await sock.groupMetadata(chat);
    const allMentions = meta.participants.map(p => p.id);

    let imgBuffer = null;
    const thumbUrl = await fetchTopGameThumbnail();
    if (thumbUrl) {
      try { imgBuffer = await fetchBuffer(thumbUrl); } catch {}
    }

    const msg = `🎉 *BIENVENUE DANS LE GROUPE ROBLOX !* 🎉\n\nJe suis votre assistant Roblox 🤖\n\n📌 *Fonctionnalités :*\n• Publications automatiques des jeux tendance\n• Astuces et secrets de vos jeux préférés\n• Réponses naturelles à vos questions\n• Modération automatique (insultes, spam)\n\n👇 *Lisez les règles avec* 👇\n\`.roblox rules\` ou tapez simplement *!regles*\n\nQue la partie commence ! 🎮🔥\n\n${allMentions.map(j => `@${j.split('@')[0]}`).join(' ')}`;

    if (imgBuffer) {
      await sock.sendMessage(chat, { image: imgBuffer, caption: msg, mentions: allMentions });
    } else {
      await sock.sendMessage(chat, { text: msg, mentions: allMentions });
    }
    log.info(`Message de bienvenue envoyé dans ${chat} (${allMentions.length} membres)`);
  } catch (e) {
    log.error(`sendGreeting: ${e.message}`);
  }
}

const warnCounts = new Map();

function getWarnCount(chat, sender) {
  const key = `${chat}:${sender}`;
  return warnCounts.get(key) || 0;
}

function addWarn(chat, sender) {
  const key = `${chat}:${sender}`;
  const count = (warnCounts.get(key) || 0) + 1;
  warnCounts.set(key, count);
  setTimeout(() => warnCounts.delete(key), 24 * 60 * 60 * 1000);
  return count;
}

export function checkInfraction(text) {
  if (INSULTS_RE.test(text)) return { type: 'insult', severity: 'high', msg: '🔇 *Pas d\'insultes !* Reste respectueux envers les membres.' };
  if (SPAM_RE.test(text)) return { type: 'spam', severity: 'high', msg: '🚫 *Pas de spam !* Évite de partager trop de liens.' };
  if (FLOOD_RE.test(text)) return { type: 'flood', severity: 'medium', msg: '⚠️ *Pas de flood !* Évite les messages répétés.' };
  return null;
}

export async function handleInfraction(sock, chat, sender, pushName) {
  try {
    const count = addWarn(chat, sender);
    const name = pushName || sender.split('@')[0];
    let action;
    if (count === 1) action = '⚠️ *Avertissement* — sois plus vigilant.';
    else if (count === 2) action = '⏳ *Mute 1h* — récidive constatée.';
    else action = '🚫 *Exclusion* — trop d\'avertissements.';

    const msg = `❌ *Infraction détectée !*\n\n👤 ${name}\n⚠️ Avertissement n°${count}\n${action}\n\n📜 Tape \`.roblox rules\` pour voir les règles.`;
    await sock.sendMessage(chat, { text: msg, mentions: [sender] });
    log.warn(`Infraction ${count} → ${name} (${sender})`);
  } catch (e) {
    log.error(`handleInfraction: ${e.message}`);
  }
}

export function getStats() {
  return {
    enabled        : isRobloxEnabled(),
    group          : getSetting(CFG.GROUP_KEY) ?? 'non configuré',
    silenceRemaining: Math.max(0, Math.round((state.silenceUntil - Date.now()) / 1000)),
    isPosting      : state.isPosting,
    queueLength    : state.postQueue.length,
    activityCount  : state.activityCount,
    sessionPosted  : state.sessionPosted.size,
    lastContentType: state.lastContentType ?? 'aucun',
    schedulerActive: !!schedulerTimeout,
  };
}
