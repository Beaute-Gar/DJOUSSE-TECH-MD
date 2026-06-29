/**
 * src/modules/groups/multi-group-engine.js
 * DJOUSSE-TECH-MD — Moteur Multi-Groupes v1.0
 *
 * Orchestre l'animation intelligente et personnalisée de 7 groupes admin.
 * Chaque groupe a son propre profil, son scheduler, sa mémoire conversationnelle.
 *
 * Architecture :
 *  GroupRegistry   → Registre des groupes actifs (JID → profil)
 *  GroupScheduler  → Scheduler indépendant par groupe
 *  GroupAnimator   → Génère et publie le contenu adapté
 *  GroupBrain      → Intelligence conversationnelle contextualisée
 */

import https from 'https';
import http  from 'http';
import { GROUP_PROFILES, detectGroupProfile } from './group-profiles.js';
import { rawRun, rawGet, rawAll } from '../../lib/database.js';

// ─── Logger adaptatif ─────────────────────────────────────────────────────────
let log;
try {
  const { createLogger } = await import('../../core/logger.js');
  log = createLogger('MULTI-GROUP');
} catch {
  const tag = (l) => (...a) => console[l === 'error' ? 'error' : 'log'](`[MULTI-GROUP:${l.toUpperCase()}]`, ...a);
  log = { info: tag('info'), warn: tag('warn'), error: tag('error'), debug: () => {} };
}

// ─── DB adaptatif ─────────────────────────────────────────────────────────────
const _db = true;
try { (await import('../../lib/database.js')).getDB(); } catch {}
const dbRun  = (sql, ...p)  => { try { rawRun(sql, ...p); } catch {} };
const dbGet  = (sql, ...p)  => { try { return rawGet(sql, ...p) ?? null; } catch { return null; } };
const dbAll  = (sql, ...p)  => { try { return rawAll(sql, ...p) ?? []; } catch { return []; } };

// ─── Utilitaires HTTP (sans dépendance utils.js) ──────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function robustFetch(url, { retries = 3, timeout = 12_000, method = 'GET', body } = {}) {
  const lib = url.startsWith('https') ? https : http;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const u    = new URL(url);
        const opts = {
          hostname: u.hostname,
          path    : u.pathname + u.search,
          method,
          headers : {
            'User-Agent'  : 'DJousseTechBot/3.0',
            'Accept'      : 'application/json',
            'Content-Type': 'application/json',
          },
          timeout,
        };
        const req = lib.request(opts, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON_PARSE_ERROR')); }
            } else { reject(new Error(`HTTP_${res.statusCode}`)); }
          });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
        req.on('error',   (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
    }
  }
}

async function fetchImageBuffer(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, { headers: { 'User-Agent': 'DJousseTechBot/3.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject).setTimeout(15_000, function () { this.destroy(); reject(new Error('IMG_TIMEOUT')); });
  });
}

// ─── GEMINI : génération de contenu ──────────────────────────────────────────

async function callGemini(prompt, { maxTokens = 220, temperature = 0.88, systemPrompt = null } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante');

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature, topP: 0.92 },
  };
  if (systemPrompt) {
    payload.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  const data = await robustFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    { method: 'POST', timeout: 18_000, retries: 2, body: payload }
  );
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Réponse Gemini vide');
  return text;
}

// ─── GEMINI : recherche d'image via prompt ────────────────────────────────────

async function fetchThematicImage(profileKey, contentType) {
  const sources = {
    otaku_empire: [
      `https://api.jikan.moe/v4/anime?q=&order_by=score&sort=desc&limit=1&page=${Math.ceil(Math.random()*5)}`,
    ],
    roblox: [],
  };

  if (profileKey === 'otaku_empire') {
    try {
      const data = await robustFetch(sources.otaku_empire[0], { timeout: 8_000 });
      const anime = data?.data?.[Math.floor(Math.random() * (data?.data?.length || 1))];
      if (anime?.images?.jpg?.large_image_url) {
        const imgBuf = await fetchImageBuffer(anime.images.jpg.large_image_url);
        return {
          buffer : imgBuf,
          caption: `🎌 *${anime.title}* (${anime.year || '?'})\n⭐ ${anime.score}/10 · ${anime.episodes || '?'} épisodes\n📺 ${anime.synopsis?.slice(0, 120) || ''}...`,
          source : 'jikan_api',
        };
      }
    } catch (e) { log.warn(`fetchThematicImage otaku: ${e.message}`); }
  }
  return null;
}

// ─── Mémoire conversationnelle par groupe ────────────────────────────────────
const _memFallback = new Map();

function getConvHistory(groupJid, limit = 10) {
  if (_db) {
    return dbAll(
      `SELECT role, content FROM mg_conv_memory
       WHERE group_jid = ?
       ORDER BY ts DESC LIMIT ?`,
      groupJid, limit
    ).reverse();
  }
  return (_memFallback.get(groupJid) || []).slice(-limit);
}

function saveConvHistory(groupJid, role, content) {
  if (_db) {
    dbRun('INSERT INTO mg_conv_memory (group_jid, role, content) VALUES (?,?,?)',
      groupJid, role, content.slice(0, 500));
    dbRun(`DELETE FROM mg_conv_memory
           WHERE group_jid = ? AND id NOT IN (
             SELECT id FROM mg_conv_memory WHERE group_jid = ?
             ORDER BY ts DESC LIMIT 20
           )`, groupJid, groupJid);
  } else {
    const arr = _memFallback.get(groupJid) || [];
    arr.push({ role, content: content.slice(0, 500) });
    if (arr.length > 20) arr.splice(0, arr.length - 20);
    _memFallback.set(groupJid, arr);
  }
}

// ─── Déduplication des contenus publiés ──────────────────────────────────────
const _postedFallback = new Map();

function hasPostedRecently(groupJid, contentKey, withinHours = 48) {
  if (_db) {
    const r = dbGet(
      `SELECT 1 FROM mg_posted
       WHERE group_jid = ? AND content_key = ?
         AND posted_at > datetime('now', ? )`,
      groupJid, contentKey, `-${withinHours} hours`
    );
    return !!r;
  }
  const set = _postedFallback.get(groupJid) || new Set();
  return set.has(contentKey);
}

function markPosted(groupJid, contentKey) {
  if (_db) {
    dbRun('INSERT INTO mg_posted (group_jid, content_key) VALUES (?,?)', groupJid, contentKey);
    dbRun(`DELETE FROM mg_posted
           WHERE group_jid = ? AND posted_at < datetime('now', '-7 days')`, groupJid);
  } else {
    const set = _postedFallback.get(groupJid) || new Set();
    set.add(contentKey);
    _postedFallback.set(groupJid, set);
  }
}

// ─── Détection d'intent universelle + boost profil ───────────────────────────

function detectIntent(text, profile) {
  const t = text.toLowerCase();

  const priorityMatch = profile.intent.priority.some(rx => rx.test(t));

  const isQuestion   = /\?|comment|pourquoi|c'est quoi|quel|qu'est[-\s]ce|vous pensez/.test(t);
  const isHype       = /!{2,}|🔥|💥|incroyable|trop bien|c'est fou|légendaire/.test(t);
  const isDebate     = /meilleur|pire|préfère|mieux|vs|versus|ou bien|votre avis/.test(t);
  const isMention    = /@/.test(text);
  const isShort      = text.trim().length < 15;

  let replyChance = 0.45;

  if (priorityMatch) replyChance += profile.intent.replyChanceBoost;
  if (isQuestion)    replyChance += 0.30;
  if (isHype)        replyChance += 0.15;
  if (isDebate)      replyChance += 0.20;
  if (isMention)     replyChance += 0.40;
  if (isShort)       replyChance -= 0.25;

  replyChance = Math.max(0.05, Math.min(0.95, replyChance));

  return {
    replyChance,
    isPriority: priorityMatch,
    isQuestion,
    isHype,
    isDebate,
  };
}

// ─── REGISTRE DES GROUPES ─────────────────────────────────────────────────────

const registry = new Map();

/**
 * Enregistre un groupe et démarre son scheduler.
 * @param {string} jid       - JID WhatsApp du groupe
 * @param {string} groupName - Nom du groupe (depuis groupMetadata)
 * @param {object} sock      - Socket Baileys
 */
export function registerGroup(jid, groupName, sock) {
  if (registry.has(jid)) {
    log.debug(`Groupe déjà enregistré : ${groupName}`);
    return;
  }

  const profile = detectGroupProfile(groupName);

  dbRun(
    `INSERT OR REPLACE INTO mg_groups (jid, profile_key, group_name) VALUES (?,?,?)`,
    jid, profile.identity.type, groupName
  );

  const entry = { profile, groupName, scheduler: null, silenceUntil: 0, activityWindow: [] };
  registry.set(jid, entry);

  if (!profile.content.delegated) {
    _startScheduler(jid, sock);
  }

  log.info(`Groupe enregistré : "${groupName}" → profil [${profile.identity.type}]`);
}

/**
 * Restaure les groupes depuis la DB au redémarrage.
 */
export async function restoreGroups(sock) {
  const rows = dbAll('SELECT jid, group_name FROM mg_groups WHERE enabled = 1');
  for (const row of rows) {
    if (!registry.has(row.jid)) {
      registerGroup(row.jid, row.group_name, sock);
    }
  }
  log.info(`${rows.length} groupe(s) restauré(s) depuis la DB`);
}

/**
 * Supprime un groupe du registre.
 */
export function unregisterGroup(jid) {
  const entry = registry.get(jid);
  if (!entry) return;
  if (entry.scheduler) clearTimeout(entry.scheduler);
  registry.delete(jid);
  dbRun('UPDATE mg_groups SET enabled = 0 WHERE jid = ?', jid);
  log.info(`Groupe désenregistré : ${jid}`);
}

// ─── SCHEDULER PAR GROUPE ────────────────────────────────────────────────────

function _calcNextInterval(profile) {
  const hour     = new Date().getHours();
  const isPeak   = profile.scheduling.peakHours.includes(hour);
  const isWeekend= [0, 6].includes(new Date().getDay());

  let base = isPeak ? profile.scheduling.intervalMin : profile.scheduling.intervalMax;
  if (isWeekend && profile.scheduling.weekendReduced) base *= 1.5;

  const jitter = (Math.random() - 0.5) * 0.25 * base;
  return Math.round((base + jitter) * 60_000);
}

function _startScheduler(jid, sock) {
  const entry = registry.get(jid);
  if (!entry) return;

  const delay = _calcNextInterval(entry.profile);
  log.debug(`Scheduler [${entry.profile.identity.type}] → prochain post dans ${Math.round(delay / 60000)} min`);

  entry.scheduler = setTimeout(async () => {
    try {
      if (registry.has(jid)) {
        await publishContent(jid, sock);
      }
    } catch (e) {
      log.error(`Scheduler [${jid}]: ${e.message}`);
    } finally {
      if (registry.has(jid)) _startScheduler(jid, sock);
    }
  }, delay);
}

// ─── ANIMATEUR : génération et publication du contenu ─────────────────────────

function _pickContentType(profile, groupJid) {
  const available = profile.content.types.filter(t =>
    !hasPostedRecently(groupJid, t, 6)
  );
  const pool = available.length > 0 ? available : profile.content.types;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function _generateContent(profile, contentType) {
  const generator = profile.content.generators?.[contentType];
  if (!generator) throw new Error(`Générateur manquant : ${contentType}`);

  const systemInstruction = `Tu es ${profile.persona.role} dans un groupe WhatsApp.
${profile.persona.tone}
CONTRAINTES ABSOLUES :
— Réponds UNIQUEMENT en français
— Aucun préfixe de commande (., !, /)
— Aucune liste de commandes ou menu
— Pas de balises Markdown (**, ##) sauf *gras* WhatsApp
— Max 5 lignes au total`;

  return callGemini(generator, {
    maxTokens   : 250,
    temperature : 0.90,
    systemPrompt: systemInstruction,
  });
}

/**
 * Publie un contenu dans un groupe.
 * @param {string} jid
 * @param {object} sock
 */
export async function publishContent(jid, sock) {
  const entry = registry.get(jid);
  if (!entry) return;

  const { profile, silenceUntil } = entry;

  if (Date.now() < silenceUntil) {
    log.debug(`Silence actif pour [${profile.identity.name}] — publication différée`);
    return;
  }

  const activeCount = entry.activityWindow.filter(t => Date.now() - t < 60_000).length;
  if (activeCount > 6) {
    log.info(`[${profile.identity.name}] Groupe très actif (${activeCount} msg/min) — pause publication`);
    return;
  }

  const contentType = _pickContentType(profile, jid);
  log.info(`Publication [${profile.identity.name}] type="${contentType}"`);

  try {
    const thematicImg = await fetchThematicImage(profile.identity.type, contentType).catch(() => null);

    if (thematicImg) {
      await sock.sendMessage(jid, { image: thematicImg.buffer, caption: thematicImg.caption });
    } else {
      const text = await _generateContent(profile, contentType);
      await sock.sendMessage(jid, { text });
    }

    markPosted(jid, contentType);
    entry.silenceUntil = Date.now() + profile.scheduling.silenceAfterPost;
    log.info(`✅ Publié [${profile.identity.name}] — silence ${Math.round(profile.scheduling.silenceAfterPost / 60000)} min`);

  } catch (e) {
    log.error(`publishContent [${profile.identity.name}]: ${e.message}`);
  }
}

// ─── CERVEAU : conversation naturelle contextualisée ─────────────────────────

/**
 * Gère une réponse conversationnelle dans un groupe enregistré.
 * @param {object} sock
 * @param {object} m        - Message sérialisé
 * @param {string} text     - Texte sanitisé
 * @param {string} groupJid - JID du groupe
 */
export async function handleGroupMessage(sock, m, text, groupJid) {
  const entry = registry.get(groupJid);
  if (!entry) return;

  const { profile } = entry;

  if (profile.content.delegated) return;

  entry.activityWindow = entry.activityWindow.filter(t => Date.now() - t < 60_000);
  entry.activityWindow.push(Date.now());

  if (Date.now() < entry.silenceUntil) return;

  if (m.key.fromMe) return;

  const intent = detectIntent(text, profile);

  if (Math.random() > intent.replyChance) return;

  const delay = 1500 + Math.random() * 3500;
  await sleep(delay);

  const userName = m.pushName || m.sender?.split('@')[0] || 'toi';
  const history  = getConvHistory(groupJid, 8);

  const convContext = history.length > 0
    ? history.map(h => `${h.role === 'user' ? 'Membre' : 'Moi'}: ${h.content}`).join('\n')
    : '';

  const prompt =
`${convContext ? `Historique récent:\n${convContext}\n\n` : ''}${userName} vient de dire : "${text}"

Réponds de façon naturelle, courte et contextuelle.`;

  try {
    const reply = await callGemini(prompt, {
      maxTokens   : 180,
      temperature : 0.87,
      systemPrompt: `${profile.persona.tone}
RAPPEL : Tu n'es PAS un bot. Tu es un membre humain du groupe. Jamais de menus, jamais de commandes.`,
    });

    if (!reply) return;

    const cleanReply = reply.trim().slice(0, 600);
    await sock.sendMessage(groupJid, { text: cleanReply }, { quoted: m });

    saveConvHistory(groupJid, 'user',      `${userName}: ${text}`);
    saveConvHistory(groupJid, 'assistant', cleanReply);

    entry.silenceUntil = Date.now() + profile.scheduling.silenceAfterReply;

    log.info(`Réponse [${profile.identity.name}] intent=${intent.isQuestion ? 'Q' : intent.isHype ? 'H' : 'G'} → ${userName}`);

  } catch (e) {
    log.error(`handleGroupMessage [${profile.identity.name}]: ${e.message}`);
  }
}

// ─── API publique — Statistiques ─────────────────────────────────────────────

export function getMultiGroupStats() {
  const stats = [];
  for (const [jid, entry] of registry) {
    const silenceLeft = Math.max(0, Math.round((entry.silenceUntil - Date.now()) / 1000));
    const activeCount = entry.activityWindow.filter(t => Date.now() - t < 60_000).length;
    stats.push({
      jid,
      name         : entry.profile.identity.name,
      type         : entry.profile.identity.type,
      silenceLeft  : `${silenceLeft}s`,
      activityRate : `${activeCount} msg/min`,
      schedulerActive: !!entry.scheduler,
    });
  }
  return stats;
}

export function getRegisteredGroups() {
  return [...registry.keys()];
}

export function isRegistered(jid) {
  return registry.has(jid);
}

/**
 * Force une publication immédiate dans un groupe spécifique.
 */
export async function forcePublish(jid, sock) {
  const entry = registry.get(jid);
  if (!entry) throw new Error(`Groupe non enregistré : ${jid}`);
  entry.silenceUntil = 0;
  await publishContent(jid, sock);
}
